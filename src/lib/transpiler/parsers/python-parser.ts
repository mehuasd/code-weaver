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
  indent: number;
}

export class PythonParser {
  private tokens: Token[] = [];
  private pos = 0;
  private lines: string[] = [];
  private maxIterations = 10000; // Prevent infinite loops

  parse(code: string): IRProgram {
    try {
      this.lines = code.split('\n');
      this.tokens = this.tokenize(code);
      this.pos = 0;
      
      const body: IRNode[] = [];
      let iterations = 0;
      
      while (this.pos < this.tokens.length && iterations < this.maxIterations) {
        iterations++;
        const node = this.parseStatement(0);
        if (node) body.push(node);
      }
      
      return {
        type: 'program',
        body,
        imports: this.detectImports(code),
      };
    } catch (error) {
      console.error('Python parser error:', error);
      return { type: 'program', body: [], imports: [] };
    }
  }

  private tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    const lines = code.split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      let col = 0;
      
      // Calculate indentation (spaces at start of line)
      const indentMatch = line.match(/^(\s*)/);
      const lineIndent = indentMatch ? indentMatch[1].length : 0;
      
      // Skip empty lines
      if (line.trim().length === 0) continue;
      
      // Skip leading whitespace for tokenizing
      col = lineIndent;
      
      while (col < line.length) {
        const remaining = line.slice(col);
        
        // Skip whitespace (after indentation)
        if (/^\s+/.test(remaining)) {
          const match = remaining.match(/^\s+/);
          col += match![0].length;
          continue;
        }
        
        // Comments
        if (remaining.startsWith('#')) {
          tokens.push({ type: 'COMMENT', value: remaining, line: lineNum, column: col, indent: lineIndent });
          break;
        }
        
        // String literals (including f-strings) - handle carefully
        const fStringMatch = remaining.match(/^f(["'])((?:\\.|(?!\1)[^\\])*?)\1/);
        if (fStringMatch) {
          tokens.push({ type: 'STRING', value: fStringMatch[0], line: lineNum, column: col, indent: lineIndent });
          col += fStringMatch[0].length;
          continue;
        }
        
        // Regular strings
        const stringMatch = remaining.match(/^(["'])((?:\\.|(?!\1)[^\\])*?)\1/);
        if (stringMatch) {
          tokens.push({ type: 'STRING', value: stringMatch[0], line: lineNum, column: col, indent: lineIndent });
          col += stringMatch[0].length;
          continue;
        }
        
        // Triple quoted strings
        const tripleMatch = remaining.match(/^(f?"""[\s\S]*?"""|f?'''[\s\S]*?''')/);
        if (tripleMatch) {
          tokens.push({ type: 'STRING', value: tripleMatch[0], line: lineNum, column: col, indent: lineIndent });
          col += tripleMatch[0].length;
          continue;
        }
        
        // Numbers
        const numMatch = remaining.match(/^\d+\.?\d*/);
        if (numMatch) {
          tokens.push({ type: 'NUMBER', value: numMatch[0], line: lineNum, column: col, indent: lineIndent });
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
          tokens.push({ type, value: wordMatch[0], line: lineNum, column: col, indent: lineIndent });
          col += wordMatch[0].length;
          continue;
        }
        
        // Operators
        const opMatch = remaining.match(/^(==|!=|<=|>=|<<|>>|\+=|-=|\*=|\/=|->|::|[+\-*/%<>=!&|^~])/);
        if (opMatch) {
          tokens.push({ type: 'OPERATOR', value: opMatch[0], line: lineNum, column: col, indent: lineIndent });
          col += opMatch[0].length;
          continue;
        }
        
        // Punctuation
        const punctMatch = remaining.match(/^[()[\]{},;:.]/);
        if (punctMatch) {
          tokens.push({ type: 'PUNCTUATION', value: punctMatch[0], line: lineNum, column: col, indent: lineIndent });
          col += 1;
          continue;
        }
        
        col++;
      }
      
      // Add newline token at end of each non-empty line
      tokens.push({ type: 'NEWLINE', value: '\n', line: lineNum, column: col, indent: lineIndent });
    }
    
    return tokens;
  }

  private peek(offset = 0): Token | null {
    return this.tokens[this.pos + offset] || null;
  }

  private advance(): Token | null {
    if (this.pos >= this.tokens.length) return null;
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
    let count = 0;
    while (this.match('NEWLINE') && count < 100) {
      this.advance();
      count++;
    }
  }

  private getCurrentIndent(): number {
    const token = this.peek();
    return token ? token.indent : 0;
  }

  private parseStatement(minIndent: number): IRNode | null {
    this.skipNewlines();
    
    const token = this.peek();
    if (!token) return null;
    
    // Check if we've dedented past our block
    if (token.indent < minIndent) {
      return null;
    }
    
    // Comments
    if (token.type === 'COMMENT') {
      this.advance();
      this.skipNewlines();
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
      return this.parseIf(minIndent);
    }
    
    // For loop
    if (this.match('KEYWORD', 'for')) {
      return this.parseFor(minIndent);
    }
    
    // While loop
    if (this.match('KEYWORD', 'while')) {
      return this.parseWhile(minIndent);
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
    const defToken = this.consume('KEYWORD', 'def')!;
    const functionIndent = defToken.indent;
    
    const nameToken = this.consume('IDENTIFIER');
    const name = nameToken?.value || 'unknown';
    
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    // Parse function body - only statements with indent > functionIndent
    const body = this.parseBlock(functionIndent);
    
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

  private parseBlock(parentIndent: number): IRNode[] {
    const statements: IRNode[] = [];
    const blockIndent = parentIndent + 4; // Python standard indent
    let iterations = 0;
    
    while (this.pos < this.tokens.length && iterations < this.maxIterations) {
      iterations++;
      this.skipNewlines();
      
      const token = this.peek();
      if (!token) break;
      
      // Check if we've returned to parent indent level (or less)
      if (token.indent <= parentIndent) {
        break;
      }
      
      const stmt = this.parseStatement(blockIndent);
      if (stmt) {
        statements.push(stmt);
      } else {
        break;
      }
    }
    
    return statements;
  }

  private parseClassDef(): IRClass {
    const classToken = this.consume('KEYWORD', 'class')!;
    const classIndent = classToken.indent;
    
    const nameToken = this.consume('IDENTIFIER');
    const name = nameToken?.value || 'Unknown';
    
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const members: IRVariable[] = [];
    const methods: IRFunction[] = [];
    let constructor: IRFunction | undefined;
    
    // Parse class body
    const body = this.parseBlock(classIndent);
    
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

  private parseIf(minIndent: number): IRIf {
    const ifToken = this.consume('KEYWORD', 'if')!;
    const ifIndent = ifToken.indent;
    
    const condition = this.parseExpression();
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const thenBranch = this.parseBlock(ifIndent);
    let elseBranch: IRNode[] | undefined;
    let elseIf: IRIf | undefined;
    
    this.skipNewlines();
    
    // Check for elif or else at the same indent level
    const nextToken = this.peek();
    if (nextToken && nextToken.indent === ifIndent) {
      if (this.match('KEYWORD', 'elif')) {
        elseIf = this.parseElif(ifIndent);
      } else if (this.match('KEYWORD', 'else')) {
        this.advance();
        this.consume('PUNCTUATION', ':');
        this.skipNewlines();
        elseBranch = this.parseBlock(ifIndent);
      }
    }
    
    return {
      type: 'if',
      condition,
      thenBranch,
      elseBranch,
      elseIf,
    };
  }

  private parseElif(parentIndent: number): IRIf {
    this.consume('KEYWORD', 'elif');
    const condition = this.parseExpression();
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const thenBranch = this.parseBlock(parentIndent);
    let elseBranch: IRNode[] | undefined;
    let elseIf: IRIf | undefined;
    
    this.skipNewlines();
    
    const nextToken = this.peek();
    if (nextToken && nextToken.indent === parentIndent) {
      if (this.match('KEYWORD', 'elif')) {
        elseIf = this.parseElif(parentIndent);
      } else if (this.match('KEYWORD', 'else')) {
        this.advance();
        this.consume('PUNCTUATION', ':');
        this.skipNewlines();
        elseBranch = this.parseBlock(parentIndent);
      }
    }
    
    return {
      type: 'if',
      condition,
      thenBranch,
      elseBranch,
      elseIf,
    };
  }

  private parseFor(minIndent: number): IRFor {
    const forToken = this.consume('KEYWORD', 'for')!;
    const forIndent = forToken.indent;
    
    const iterToken = this.consume('IDENTIFIER');
    const iterator = iterToken?.value || 'i';
    
    this.consume('KEYWORD', 'in');
    
    // Check for range()
    if (this.match('KEYWORD', 'range') || this.match('IDENTIFIER', 'range')) {
      this.advance();
      this.consume('PUNCTUATION', '(');
      
      const args: IRNode[] = [];
      while (!this.match('PUNCTUATION', ')') && args.length < 10) {
        args.push(this.parseExpression());
        if (!this.consume('PUNCTUATION', ',')) break;
      }
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ':');
      this.skipNewlines();
      
      const body = this.parseBlock(forIndent);
      
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
    const body = this.parseBlock(forIndent);
    
    return {
      type: 'for',
      iterator,
      condition: iterable,
      body,
    };
  }

  private parseWhile(minIndent: number): IRWhile {
    const whileToken = this.consume('KEYWORD', 'while')!;
    const whileIndent = whileToken.indent;
    
    const condition = this.parseExpression();
    this.consume('PUNCTUATION', ':');
    this.skipNewlines();
    
    const body = this.parseBlock(whileIndent);
    
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
    
    while (!this.match('PUNCTUATION', ')') && args.length < 20) {
      // Check for keyword arguments like end=''
      if (this.match('IDENTIFIER', 'end') || this.match('IDENTIFIER', 'sep')) {
        // Skip keyword argument
        this.advance(); // skip 'end' or 'sep'
        this.consume('OPERATOR', '=');
        this.parseExpression(); // skip the value
        if (!this.consume('PUNCTUATION', ',')) break;
        continue;
      }
      
      args.push(this.parseExpression());
      if (!this.consume('PUNCTUATION', ',')) break;
    }
    
    this.consume('PUNCTUATION', ')');
    
    return { type: 'print', args, newline: true };
  }

  private parseInput(): IRInput {
    this.consume('KEYWORD', 'input');
    this.consume('PUNCTUATION', '(');
    
    let prompt: string | undefined;
    
    if (this.match('STRING')) {
      const strToken = this.advance()!;
      prompt = strToken.value.slice(1, -1); // Remove quotes
    }
    
    this.consume('PUNCTUATION', ')');
    
    return { type: 'input', prompt };
  }

  private parseAssignmentOrExpression(): IRNode | null {
    const startPos = this.pos;
    const left = this.parseExpression();
    
    if (!left) return null;
    
    // Check for assignment
    if (this.match('OPERATOR', '=')) {
      this.advance();
      const value = this.parseExpression();
      
      if (left.type === 'identifier') {
        const target = (left as IRIdentifier).name;
        
        // Check if it's a new variable declaration
        if (!target.includes('.')) {
          return {
            type: 'variable',
            name: target,
            dataType: this.inferType(value),
            value,
          } as IRVariable;
        }
        
        return {
          type: 'assignment',
          target,
          value,
        } as IRAssignment;
      }
    }
    
    // Compound assignment
    const compoundOps = ['+=', '-=', '*=', '/='];
    for (const op of compoundOps) {
      if (this.match('OPERATOR', op)) {
        this.advance();
        const right = this.parseExpression();
        
        if (left.type === 'identifier') {
          return {
            type: 'assignment',
            target: (left as IRIdentifier).name,
            value: {
              type: 'binary_op',
              operator: op[0],
              left,
              right,
            } as IRBinaryOp,
          } as IRAssignment;
        }
      }
    }
    
    // Just an expression (like a function call)
    return left;
  }

  private parseExpression(): IRNode {
    return this.parseOr();
  }

  private parseOr(): IRNode {
    let left = this.parseAnd();
    
    while (this.match('KEYWORD', 'or')) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'binary_op', operator: '||', left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseAnd(): IRNode {
    let left = this.parseNot();
    
    while (this.match('KEYWORD', 'and')) {
      this.advance();
      const right = this.parseNot();
      left = { type: 'binary_op', operator: '&&', left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseNot(): IRNode {
    if (this.match('KEYWORD', 'not')) {
      this.advance();
      const operand = this.parseNot();
      return { type: 'unary_op', operator: '!', operand } as IRNode & { operator: string; operand: IRNode };
    }
    return this.parseComparison();
  }

  private parseComparison(): IRNode {
    let left = this.parseAddSub();
    
    const compOps = ['==', '!=', '<', '>', '<=', '>='];
    let iterations = 0;
    while (iterations < 20) {
      iterations++;
      let found = false;
      for (const op of compOps) {
        if (this.match('OPERATOR', op)) {
          this.advance();
          const right = this.parseAddSub();
          left = { type: 'binary_op', operator: op, left, right } as IRBinaryOp;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    
    return left;
  }

  private parseAddSub(): IRNode {
    let left = this.parseMulDiv();
    
    while (this.match('OPERATOR', '+') || this.match('OPERATOR', '-')) {
      const op = this.advance()!.value;
      const right = this.parseMulDiv();
      left = { type: 'binary_op', operator: op, left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseMulDiv(): IRNode {
    let left = this.parseUnary();
    
    while (this.match('OPERATOR', '*') || this.match('OPERATOR', '/') || this.match('OPERATOR', '%')) {
      const op = this.advance()!.value;
      const right = this.parseUnary();
      left = { type: 'binary_op', operator: op, left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseUnary(): IRNode {
    if (this.match('OPERATOR', '-') || this.match('OPERATOR', '+')) {
      const op = this.advance()!.value;
      const operand = this.parseUnary();
      return { type: 'unary_op', operator: op, operand } as IRNode & { operator: string; operand: IRNode };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): IRNode {
    // Parentheses
    if (this.match('PUNCTUATION', '(')) {
      this.advance();
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return expr;
    }
    
    // Number
    if (this.match('NUMBER')) {
      const token = this.advance()!;
      const value = token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value);
      const dataType: DataType = token.value.includes('.') ? 'float' : 'int';
      return { type: 'literal', value, dataType } as IRLiteral;
    }
    
    // String
    if (this.match('STRING')) {
      const token = this.advance()!;
      let value = token.value;
      
      // Handle f-strings
      const isFString = value.startsWith('f"') || value.startsWith("f'");
      if (isFString) {
        value = value.slice(2, -1); // Remove f and quotes
      } else {
        value = value.slice(1, -1); // Remove quotes
      }
      
      return { 
        type: 'literal', 
        value, 
        dataType: 'string',
        isFString,
      } as IRLiteral & { isFString?: boolean };
    }
    
    // Boolean
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
    
    // Built-in type conversions
    if (this.match('KEYWORD', 'int') || this.match('KEYWORD', 'float') || this.match('KEYWORD', 'str')) {
      const typeFunc = this.advance()!.value;
      this.consume('PUNCTUATION', '(');
      const args: IRNode[] = [];
      while (!this.match('PUNCTUATION', ')') && args.length < 10) {
        args.push(this.parseExpression());
        if (!this.consume('PUNCTUATION', ',')) break;
      }
      this.consume('PUNCTUATION', ')');
      return { type: 'call', callee: typeFunc, args } as IRCall;
    }
    
    // Input as expression
    if (this.match('KEYWORD', 'input')) {
      this.advance();
      this.consume('PUNCTUATION', '(');
      let prompt: string | undefined;
      if (this.match('STRING')) {
        const strToken = this.advance()!;
        prompt = strToken.value.slice(1, -1);
      }
      this.consume('PUNCTUATION', ')');
      return { type: 'input', prompt } as IRInput;
    }
    
    // Print as expression (rare but possible)
    if (this.match('KEYWORD', 'print')) {
      return this.parsePrint();
    }
    
    // Range as expression (for list comprehensions etc)
    if (this.match('KEYWORD', 'range') || this.match('IDENTIFIER', 'range')) {
      this.advance();
      this.consume('PUNCTUATION', '(');
      const args: IRNode[] = [];
      while (!this.match('PUNCTUATION', ')') && args.length < 10) {
        args.push(this.parseExpression());
        if (!this.consume('PUNCTUATION', ',')) break;
      }
      this.consume('PUNCTUATION', ')');
      return { type: 'call', callee: 'range', args } as IRCall;
    }
    
    // Identifier or function call
    if (this.match('IDENTIFIER') || this.match('KEYWORD', 'self')) {
      const token = this.advance()!;
      let name = token.value;
      
      // Check for attribute access
      while (this.match('PUNCTUATION', '.')) {
        this.advance();
        const attr = this.consume('IDENTIFIER');
        if (attr) name += '.' + attr.value;
      }
      
      // Check for function call
      if (this.match('PUNCTUATION', '(')) {
        this.advance();
        const args: IRNode[] = [];
        while (!this.match('PUNCTUATION', ')') && args.length < 20) {
          args.push(this.parseExpression());
          if (!this.consume('PUNCTUATION', ',')) break;
        }
        this.consume('PUNCTUATION', ')');
        
        // Check if it's a method call
        const parts = name.split('.');
        if (parts.length > 1) {
          return {
            type: 'call',
            callee: parts[parts.length - 1],
            args,
            isMethod: true,
            object: parts.slice(0, -1).join('.'),
          } as IRCall;
        }
        
        return { type: 'call', callee: name, args } as IRCall;
      }
      
      return { type: 'identifier', name } as IRIdentifier;
    }
    
    // Empty expression - skip unknown tokens
    if (this.pos < this.tokens.length) {
      this.advance();
    }
    return { type: 'literal', value: '', dataType: 'void' } as IRLiteral;
  }

  private inferType(node: IRNode): DataType {
    if (node.type === 'literal') {
      return (node as IRLiteral).dataType;
    }
    if (node.type === 'binary_op') {
      const binOp = node as IRBinaryOp;
      const leftType = this.inferType(binOp.left);
      const rightType = this.inferType(binOp.right);
      
      // Comparison operators return bool
      if (['==', '!=', '<', '>', '<=', '>='].includes(binOp.operator)) {
        return 'bool';
      }
      
      // If either is float, result is float
      if (leftType === 'float' || rightType === 'float') return 'float';
      if (leftType === 'double' || rightType === 'double') return 'double';
      if (leftType === 'string' || rightType === 'string') return 'string';
      return 'int';
    }
    if (node.type === 'call') {
      const call = node as IRCall;
      if (call.callee === 'int') return 'int';
      if (call.callee === 'float') return 'float';
      if (call.callee === 'str') return 'string';
      if (call.callee === 'input') return 'string';
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
