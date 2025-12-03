import {
  IRNode,
  IRProgram,
  IRVariable,
  IRFunction,
  IRClass,
  IRIf,
  IRFor,
  IRWhile,
  IRReturn,
  IRPrint,
  IRInput,
  IRCall,
  IRBinaryOp,
  IRLiteral,
  IRIdentifier,
  IRComment,
  IRAssignment,
  DataType,
} from '../ir';

interface Token {
  type: string;
  value: string;
  line: number;
  column: number;
}

export class PythonParser {
  private tokens: Token[] = [];
  private pos = 0;
  private currentIndent = 0;

  parse(code: string): IRProgram {
    this.tokens = this.tokenize(code);
    this.pos = 0;
    
    const body: IRNode[] = [];
    
    while (this.pos < this.tokens.length) {
      const node = this.parseStatement();
      if (node) body.push(node);
    }
    
    return {
      type: 'program',
      body,
      imports: this.detectImports(code),
    };
  }

  private tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    const lines = code.split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      let col = 0;
      
      // Handle indentation
      const indentMatch = line.match(/^(\s*)/);
      if (indentMatch && indentMatch[1].length > 0 && line.trim().length > 0) {
        tokens.push({ type: 'INDENT', value: indentMatch[1], line: lineNum, column: 0 });
        col = indentMatch[1].length;
      }
      
      while (col < line.length) {
        const remaining = line.slice(col);
        
        // Skip whitespace (not at start of line)
        if (/^\s+/.test(remaining) && col > 0) {
          const match = remaining.match(/^\s+/);
          col += match![0].length;
          continue;
        }
        
        // Comments
        if (remaining.startsWith('#')) {
          tokens.push({ type: 'COMMENT', value: remaining, line: lineNum, column: col });
          break;
        }
        
        // String literals
        const stringMatch = remaining.match(/^(f?["'])((?:\\.|[^"'\\])*?)\1/) ||
                           remaining.match(/^(f?""")([\s\S]*?)"""/);
        if (stringMatch) {
          tokens.push({ type: 'STRING', value: stringMatch[0], line: lineNum, column: col });
          col += stringMatch[0].length;
          continue;
        }
        
        // Numbers
        const numMatch = remaining.match(/^\d+\.?\d*/);
        if (numMatch) {
          tokens.push({ type: 'NUMBER', value: numMatch[0], line: lineNum, column: col });
          col += numMatch[0].length;
          continue;
        }
        
        // Keywords and identifiers
        const wordMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
        if (wordMatch) {
          const keywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 
                          'print', 'input', 'in', 'range', 'True', 'False', 'None', 'and', 
                          'or', 'not', 'self', 'int', 'float', 'str', 'bool'];
          const type = keywords.includes(wordMatch[0]) ? 'KEYWORD' : 'IDENTIFIER';
          tokens.push({ type, value: wordMatch[0], line: lineNum, column: col });
          col += wordMatch[0].length;
          continue;
        }
        
        // Operators
        const opMatch = remaining.match(/^(==|!=|<=|>=|<<|>>|\+=|-=|\*=|\/=|->|::|[+\-*/%<>=!&|^~])/);
        if (opMatch) {
          tokens.push({ type: 'OPERATOR', value: opMatch[0], line: lineNum, column: col });
          col += opMatch[0].length;
          continue;
        }
        
        // Punctuation
        const punctMatch = remaining.match(/^[()[\]{},;:.]/);
        if (punctMatch) {
          tokens.push({ type: 'PUNCTUATION', value: punctMatch[0], line: lineNum, column: col });
          col += 1;
          continue;
        }
        
        col++;
      }
      
      if (line.trim().length > 0) {
        tokens.push({ type: 'NEWLINE', value: '\n', line: lineNum, column: col });
      }
    }
    
    return tokens;
  }

  private peek(offset = 0): Token | null {
    return this.tokens[this.pos + offset] || null;
  }

  private advance(): Token | null {
    return this.tokens[this.pos++] || null;
  }

  private match(type: string, value?: string): boolean {
    const token = this.peek();
    if (!token) return false;
    if (token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  }

  private consume(type: string, value?: string): Token | null {
    if (this.match(type, value)) {
      return this.advance();
    }
    return null;
  }

  private skipNewlines(): void {
    while (this.match('NEWLINE') || this.match('INDENT')) {
      this.advance();
    }
  }

  private parseStatement(): IRNode | null {
    this.consume('INDENT');
    this.skipNewlines();
    
    const token = this.peek();
    if (!token) return null;
    
    // Comments
    if (token.type === 'COMMENT') {
      this.advance();
      return {
        type: 'comment',
        text: token.value.slice(1).trim(),
      } as IRComment;
    }
    
    // Function definition
    if (this.match('KEYWORD', 'def')) {
      return this.parseFunctionDef();
    }
    
    // Class definition
    if (this.match('KEYWORD', 'class')) {
      return this.parseClassDef();
    }
    
    // If statement
    if (this.match('KEYWORD', 'if')) {
      return this.parseIf();
    }
    
    // For loop
    if (this.match('KEYWORD', 'for')) {
      return this.parseFor();
    }
    
    // While loop
    if (this.match('KEYWORD', 'while')) {
      return this.parseWhile();
    }
    
    // Return statement
    if (this.match('KEYWORD', 'return')) {
      return this.parseReturn();
    }
    
    // Print statement
    if (this.match('KEYWORD', 'print')) {
      return this.parsePrint();
    }
    
    // Input
    if (this.match('KEYWORD', 'input')) {
      return this.parseInput();
    }
    
    // Assignment or expression
    return this.parseAssignmentOrExpression();
  }

  private parseFunctionDef(): IRFunction {
    this.consume('KEYWORD', 'def');
    const nameToken = this.consume('IDENTIFIER');
    const name = nameToken?.value || 'unknown';
    
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const body = this.parseBlock();
    
    // Infer return type from return statements
    let returnType: DataType = 'void';
    for (const stmt of body) {
      if (stmt.type === 'return') {
        const retStmt = stmt as IRReturn;
        if (retStmt.value) {
          returnType = this.inferType(retStmt.value);
        }
        break;
      }
    }
    
    return {
      type: 'function',
      name,
      params,
      returnType,
      body,
    };
  }

  private parseParams(): IRVariable[] {
    const params: IRVariable[] = [];
    
    while (!this.match('PUNCTUATION', ')')) {
      if (this.match('KEYWORD', 'self')) {
        this.advance();
        this.consume('PUNCTUATION', ',');
        continue;
      }
      
      const nameToken = this.consume('IDENTIFIER');
      if (nameToken) {
        let dataType: DataType = 'auto';
        
        // Type annotation
        if (this.match('PUNCTUATION', ':')) {
          this.advance();
          const typeToken = this.consume('KEYWORD') || this.consume('IDENTIFIER');
          if (typeToken) {
            dataType = this.mapPythonType(typeToken.value);
          }
        }
        
        params.push({
          type: 'variable',
          name: nameToken.value,
          dataType,
        });
      }
      
      if (!this.consume('PUNCTUATION', ',')) break;
    }
    
    return params;
  }

  private parseBlock(): IRNode[] {
    const statements: IRNode[] = [];
    const startIndent = this.getIndentLevel();
    
    while (this.pos < this.tokens.length) {
      const indentToken = this.peek();
      if (indentToken?.type === 'INDENT') {
        const currentIndent = indentToken.value.length;
        if (currentIndent <= startIndent && statements.length > 0) break;
      } else if (statements.length > 0 && !this.match('NEWLINE')) {
        // Check if we're back to a lower indent level
        const nextToken = this.peek();
        if (nextToken && nextToken.line !== undefined) {
          const lineIndent = this.getLineIndent(nextToken.line);
          if (lineIndent <= startIndent) break;
        }
      }
      
      this.skipNewlines();
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
      else break;
    }
    
    return statements;
  }

  private getIndentLevel(): number {
    const indent = this.tokens.slice(0, this.pos).reverse().find(t => t.type === 'INDENT');
    return indent ? indent.value.length : 0;
  }

  private getLineIndent(line: number): number {
    const indent = this.tokens.find(t => t.line === line && t.type === 'INDENT');
    return indent ? indent.value.length : 0;
  }

  private parseClassDef(): IRClass {
    this.consume('KEYWORD', 'class');
    const nameToken = this.consume('IDENTIFIER');
    const name = nameToken?.value || 'Unknown';
    
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const members: IRVariable[] = [];
    const methods: IRFunction[] = [];
    let constructor: IRFunction | undefined;
    
    // Parse class body
    const body = this.parseBlock();
    
    for (const node of body) {
      if (node.type === 'function') {
        const func = node as IRFunction;
        if (func.name === '__init__') {
          constructor = func;
          // Extract member variables from constructor
          for (const stmt of func.body) {
            if (stmt.type === 'assignment') {
              const assign = stmt as IRAssignment;
              if (assign.target.startsWith('self.')) {
                members.push({
                  type: 'variable',
                  name: assign.target.replace('self.', ''),
                  dataType: 'auto',
                });
              }
            }
          }
        } else {
          methods.push(func);
        }
      }
    }
    
    return {
      type: 'class',
      name,
      members,
      methods,
      constructor,
    };
  }

  private parseIf(): IRIf {
    this.consume('KEYWORD', 'if');
    const condition = this.parseExpression();
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const thenBranch = this.parseBlock();
    let elseBranch: IRNode[] | undefined;
    let elseIf: IRIf | undefined;
    
    this.skipNewlines();
    this.consume('INDENT');
    
    if (this.match('KEYWORD', 'elif')) {
      elseIf = this.parseIf();
    } else if (this.match('KEYWORD', 'else')) {
      this.advance();
      this.consume('PUNCTUATION', ':');
      this.skipNewlines();
      elseBranch = this.parseBlock();
    }
    
    return {
      type: 'if',
      condition,
      thenBranch,
      elseBranch,
      elseIf,
    };
  }

  private parseFor(): IRFor {
    this.consume('KEYWORD', 'for');
    const iterToken = this.consume('IDENTIFIER');
    const iterator = iterToken?.value || 'i';
    
    this.consume('KEYWORD', 'in');
    
    // Check for range()
    if (this.match('KEYWORD', 'range') || this.match('IDENTIFIER', 'range')) {
      this.advance();
      this.consume('PUNCTUATION', '(');
      
      const args: IRNode[] = [];
      while (!this.match('PUNCTUATION', ')')) {
        args.push(this.parseExpression());
        this.consume('PUNCTUATION', ',');
      }
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ':');
      this.skipNewlines();
      
      const body = this.parseBlock();
      
      let rangeStart: IRNode = { type: 'literal', value: 0, dataType: 'int' } as IRLiteral;
      let rangeEnd: IRNode;
      let rangeStep: IRNode = { type: 'literal', value: 1, dataType: 'int' } as IRLiteral;
      
      if (args.length === 1) {
        rangeEnd = args[0];
      } else if (args.length === 2) {
        rangeStart = args[0];
        rangeEnd = args[1];
      } else {
        rangeStart = args[0];
        rangeEnd = args[1];
        rangeStep = args[2];
      }
      
      return {
        type: 'for',
        iterator,
        rangeStart,
        rangeEnd,
        rangeStep,
        body,
      };
    }
    
    // Other iterable
    const iterable = this.parseExpression();
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    const body = this.parseBlock();
    
    return {
      type: 'for',
      iterator,
      condition: iterable,
      body,
    };
  }

  private parseWhile(): IRWhile {
    this.consume('KEYWORD', 'while');
    const condition = this.parseExpression();
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const body = this.parseBlock();
    
    return {
      type: 'while',
      condition,
      body,
    };
  }

  private parseReturn(): IRReturn {
    this.consume('KEYWORD', 'return');
    
    if (this.match('NEWLINE') || this.pos >= this.tokens.length) {
      return { type: 'return' };
    }
    
    const value = this.parseExpression();
    return { type: 'return', value };
  }

  private parsePrint(): IRPrint {
    this.consume('KEYWORD', 'print');
    this.consume('PUNCTUATION', '(');
    
    const args: IRNode[] = [];
    while (!this.match('PUNCTUATION', ')')) {
      args.push(this.parseExpression());
      this.consume('PUNCTUATION', ',');
    }
    this.consume('PUNCTUATION', ')');
    
    return {
      type: 'print',
      args,
      newline: true,
    };
  }

  private parseInput(): IRInput {
    this.consume('KEYWORD', 'input');
    this.consume('PUNCTUATION', '(');
    
    let prompt: string | undefined;
    if (this.match('STRING')) {
      const strToken = this.advance();
      prompt = strToken?.value.slice(1, -1);
    }
    
    this.consume('PUNCTUATION', ')');
    
    return {
      type: 'input',
      prompt,
    };
  }

  private parseAssignmentOrExpression(): IRNode | null {
    const firstToken = this.peek();
    if (!firstToken) return null;
    
    // Check for variable declaration with type hint
    if (firstToken.type === 'IDENTIFIER') {
      const nextToken = this.peek(1);
      
      // Assignment: x = value
      if (nextToken?.type === 'OPERATOR' && nextToken.value === '=') {
        const name = this.advance()!.value;
        this.advance(); // consume =
        const value = this.parseExpression();
        
        // Try to infer type from value
        const dataType = this.inferType(value);
        
        return {
          type: 'variable',
          name,
          dataType,
          value,
        } as IRVariable;
      }
      
      // Type-annotated: x: int = value
      if (nextToken?.type === 'PUNCTUATION' && nextToken.value === ':') {
        const name = this.advance()!.value;
        this.advance(); // consume :
        const typeToken = this.consume('KEYWORD') || this.consume('IDENTIFIER');
        const dataType = typeToken ? this.mapPythonType(typeToken.value) : 'auto';
        
        if (this.match('OPERATOR', '=')) {
          this.advance();
          const value = this.parseExpression();
          return {
            type: 'variable',
            name,
            dataType,
            value,
          } as IRVariable;
        }
        
        return {
          type: 'variable',
          name,
          dataType,
        } as IRVariable;
      }
      
      // Self assignment: self.x = value
      if (firstToken.value === 'self' && nextToken?.type === 'PUNCTUATION' && nextToken.value === '.') {
        this.advance(); // self
        this.advance(); // .
        const member = this.consume('IDENTIFIER');
        const target = `self.${member?.value || ''}`;
        
        if (this.match('OPERATOR', '=')) {
          this.advance();
          const value = this.parseExpression();
          return {
            type: 'assignment',
            target,
            value,
          } as IRAssignment;
        }
      }
    }
    
    // Expression statement
    const expr = this.parseExpression();
    return expr;
  }

  private parseExpression(): IRNode {
    return this.parseOr();
  }

  private parseOr(): IRNode {
    let left = this.parseAnd();
    
    while (this.match('KEYWORD', 'or')) {
      this.advance();
      const right = this.parseAnd();
      left = {
        type: 'binary_op',
        operator: '||',
        left,
        right,
      } as IRBinaryOp;
    }
    
    return left;
  }

  private parseAnd(): IRNode {
    let left = this.parseComparison();
    
    while (this.match('KEYWORD', 'and')) {
      this.advance();
      const right = this.parseComparison();
      left = {
        type: 'binary_op',
        operator: '&&',
        left,
        right,
      } as IRBinaryOp;
    }
    
    return left;
  }

  private parseComparison(): IRNode {
    let left = this.parseAddSub();
    
    while (this.match('OPERATOR', '==') || this.match('OPERATOR', '!=') ||
           this.match('OPERATOR', '<') || this.match('OPERATOR', '>') ||
           this.match('OPERATOR', '<=') || this.match('OPERATOR', '>=')) {
      const op = this.advance()!.value;
      const right = this.parseAddSub();
      left = {
        type: 'binary_op',
        operator: op,
        left,
        right,
      } as IRBinaryOp;
    }
    
    return left;
  }

  private parseAddSub(): IRNode {
    let left = this.parseMulDiv();
    
    while (this.match('OPERATOR', '+') || this.match('OPERATOR', '-')) {
      const op = this.advance()!.value;
      const right = this.parseMulDiv();
      left = {
        type: 'binary_op',
        operator: op,
        left,
        right,
      } as IRBinaryOp;
    }
    
    return left;
  }

  private parseMulDiv(): IRNode {
    let left = this.parseUnary();
    
    while (this.match('OPERATOR', '*') || this.match('OPERATOR', '/') || this.match('OPERATOR', '%')) {
      const op = this.advance()!.value;
      const right = this.parseUnary();
      left = {
        type: 'binary_op',
        operator: op,
        left,
        right,
      } as IRBinaryOp;
    }
    
    return left;
  }

  private parseUnary(): IRNode {
    if (this.match('KEYWORD', 'not') || this.match('OPERATOR', '-')) {
      const op = this.advance()!.value;
      const operand = this.parseUnary();
      return {
        type: 'unary_op',
        operator: op === 'not' ? '!' : op,
        operand,
      } as IRNode & { operator: string; operand: IRNode };
    }
    
    return this.parsePrimary();
  }

  private parsePrimary(): IRNode {
    const token = this.peek();
    if (!token) {
      return { type: 'literal', value: '', dataType: 'string' } as IRLiteral;
    }
    
    // Parenthesized expression
    if (this.match('PUNCTUATION', '(')) {
      this.advance();
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return expr;
    }
    
    // String literal
    if (token.type === 'STRING') {
      this.advance();
      let value = token.value;
      // Remove quotes and f-string prefix
      if (value.startsWith('f')) value = value.slice(1);
      if (value.startsWith('"""') || value.startsWith("'''")) {
        value = value.slice(3, -3);
      } else {
        value = value.slice(1, -1);
      }
      return { type: 'literal', value, dataType: 'string' } as IRLiteral;
    }
    
    // Number literal
    if (token.type === 'NUMBER') {
      this.advance();
      const isFloat = token.value.includes('.');
      return {
        type: 'literal',
        value: isFloat ? parseFloat(token.value) : parseInt(token.value),
        dataType: isFloat ? 'float' : 'int',
      } as IRLiteral;
    }
    
    // Boolean literals
    if (this.match('KEYWORD', 'True')) {
      this.advance();
      return { type: 'literal', value: true, dataType: 'bool' } as IRLiteral;
    }
    if (this.match('KEYWORD', 'False')) {
      this.advance();
      return { type: 'literal', value: false, dataType: 'bool' } as IRLiteral;
    }
    
    // None
    if (this.match('KEYWORD', 'None')) {
      this.advance();
      return { type: 'literal', value: 'null', dataType: 'void' } as IRLiteral;
    }
    
    // Input call
    if (this.match('KEYWORD', 'input')) {
      return this.parseInput();
    }
    
    // Type conversion functions
    if (this.match('KEYWORD', 'int') || this.match('KEYWORD', 'float') || this.match('KEYWORD', 'str')) {
      const typeFunc = this.advance()!.value;
      this.consume('PUNCTUATION', '(');
      const arg = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return {
        type: 'call',
        callee: typeFunc,
        args: [arg],
      } as IRCall;
    }
    
    // Identifier or function call
    if (token.type === 'IDENTIFIER' || token.type === 'KEYWORD') {
      this.advance();
      let name = token.value;
      
      // Member access
      while (this.match('PUNCTUATION', '.')) {
        this.advance();
        const member = this.consume('IDENTIFIER');
        name += '.' + (member?.value || '');
      }
      
      // Function call
      if (this.match('PUNCTUATION', '(')) {
        this.advance();
        const args: IRNode[] = [];
        while (!this.match('PUNCTUATION', ')')) {
          args.push(this.parseExpression());
          this.consume('PUNCTUATION', ',');
        }
        this.consume('PUNCTUATION', ')');
        
        const isMethod = name.includes('.');
        const parts = name.split('.');
        
        return {
          type: 'call',
          callee: isMethod ? parts[parts.length - 1] : name,
          args,
          isMethod,
          object: isMethod ? parts.slice(0, -1).join('.') : undefined,
        } as IRCall;
      }
      
      return { type: 'identifier', name } as IRIdentifier;
    }
    
    // Fallback
    this.advance();
    return { type: 'literal', value: '', dataType: 'string' } as IRLiteral;
  }

  private inferType(node: IRNode): DataType {
    if (node.type === 'literal') {
      return (node as IRLiteral).dataType;
    }
    if (node.type === 'input') {
      return 'string';
    }
    if (node.type === 'call') {
      const call = node as IRCall;
      if (call.callee === 'int') return 'int';
      if (call.callee === 'float') return 'float';
      if (call.callee === 'str') return 'string';
    }
    return 'auto';
  }

  private mapPythonType(type: string): DataType {
    const typeMap: Record<string, DataType> = {
      'int': 'int',
      'float': 'float',
      'str': 'string',
      'bool': 'bool',
      'None': 'void',
    };
    return typeMap[type] || 'auto';
  }

  private detectImports(code: string): string[] {
    const imports: string[] = [];
    const lines = code.split('\n');
    
    for (const line of lines) {
      if (line.trim().startsWith('import ') || line.trim().startsWith('from ')) {
        imports.push(line.trim());
      }
    }
    
    return imports;
  }
}
