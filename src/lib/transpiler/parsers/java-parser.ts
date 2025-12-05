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
  DataType,
} from '../ir';

interface Token {
  type: string;
  value: string;
}

export class JavaParser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(code: string): IRProgram {
    try {
      this.tokens = this.tokenize(code);
      this.pos = 0;
      
      const body: IRNode[] = [];
      const imports: string[] = [];
      
      while (this.pos < this.tokens.length) {
        // Package and imports
        if (this.match('KEYWORD', 'package') || this.match('KEYWORD', 'import')) {
          const importStmt = this.parseImport();
          if (importStmt) imports.push(importStmt);
          continue;
        }
        
        const node = this.parseTopLevel();
        if (node) body.push(node);
      }
      
      return { type: 'program', body, imports };
    } catch (error) {
      console.error('Java parser error:', error);
      return { type: 'program', body: [], imports: [] };
    }
  }

  private tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    
    while (i < code.length) {
      // Whitespace
      if (/\s/.test(code[i])) {
        i++;
        continue;
      }
      
      // Single-line comment
      if (code.slice(i, i + 2) === '//') {
        let comment = '';
        i += 2;
        while (i < code.length && code[i] !== '\n') {
          comment += code[i++];
        }
        tokens.push({ type: 'COMMENT', value: comment });
        continue;
      }
      
      // Multi-line comment
      if (code.slice(i, i + 2) === '/*') {
        let comment = '';
        i += 2;
        while (i < code.length - 1 && code.slice(i, i + 2) !== '*/') {
          comment += code[i++];
        }
        i += 2;
        tokens.push({ type: 'MULTILINE_COMMENT', value: comment });
        continue;
      }
      
      // String literals
      if (code[i] === '"') {
        let str = '"';
        i++;
        while (i < code.length && code[i] !== '"') {
          if (code[i] === '\\') str += code[i++];
          if (i < code.length) str += code[i++];
        }
        str += '"';
        i++;
        tokens.push({ type: 'STRING', value: str });
        continue;
      }
      
      // Char literals
      if (code[i] === "'") {
        let char = "'";
        i++;
        while (i < code.length && code[i] !== "'") {
          if (code[i] === '\\') char += code[i++];
          if (i < code.length) char += code[i++];
        }
        char += "'";
        i++;
        tokens.push({ type: 'CHAR', value: char });
        continue;
      }
      
      // Numbers
      const numMatch = code.slice(i).match(/^\d+\.?\d*[fFdDlL]?/);
      if (numMatch) {
        tokens.push({ type: 'NUMBER', value: numMatch[0] });
        i += numMatch[0].length;
        continue;
      }
      
      // Keywords and identifiers
      const wordMatch = code.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (wordMatch) {
        const keywords = ['public', 'private', 'protected', 'static', 'final', 'abstract',
                         'class', 'interface', 'extends', 'implements', 'new', 'this', 'super',
                         'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
                         'continue', 'return', 'void', 'int', 'float', 'double', 'boolean',
                         'char', 'String', 'true', 'false', 'null', 'package', 'import',
                         'try', 'catch', 'finally', 'throw', 'throws'];
        const type = keywords.includes(wordMatch[0]) ? 'KEYWORD' : 'IDENTIFIER';
        tokens.push({ type, value: wordMatch[0] });
        i += wordMatch[0].length;
        continue;
      }
      
      // Multi-char operators
      const opMatch = code.slice(i).match(/^(==|!=|<=|>=|&&|\|\||<<|>>|\+\+|--|->|\+=|-=|\*=|\/=)/);
      if (opMatch) {
        tokens.push({ type: 'OPERATOR', value: opMatch[0] });
        i += opMatch[0].length;
        continue;
      }
      
      // Single char operators and punctuation
      tokens.push({ type: 'PUNCTUATION', value: code[i] });
      i++;
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

  private parseImport(): string | null {
    const keyword = this.advance();
    let statement = keyword?.value + ' ';
    
    while (!this.match('PUNCTUATION', ';') && this.pos < this.tokens.length) {
      statement += this.advance()?.value || '';
    }
    this.consume('PUNCTUATION', ';');
    
    return statement;
  }

  private parseTopLevel(): IRNode | null {
    // Comments
    if (this.match('COMMENT')) {
      const token = this.advance()!;
      return { type: 'comment', text: token.value.trim() } as IRComment;
    }
    if (this.match('MULTILINE_COMMENT')) {
      const token = this.advance()!;
      return { type: 'comment', text: token.value.trim(), isMultiline: true } as IRComment;
    }
    
    // Skip access modifiers
    while (this.match('KEYWORD', 'public') || this.match('KEYWORD', 'private') ||
           this.match('KEYWORD', 'protected') || this.match('KEYWORD', 'static') ||
           this.match('KEYWORD', 'final') || this.match('KEYWORD', 'abstract')) {
      this.advance();
    }
    
    // Class definition
    if (this.match('KEYWORD', 'class')) {
      return this.parseClass();
    }
    
    // Method or field
    if (this.isType(this.peek())) {
      return this.parseMethodOrField();
    }
    
    // Skip unknown
    this.advance();
    return null;
  }

  private isType(token: Token | null): boolean {
    if (!token) return false;
    return (token.type === 'KEYWORD' && 
            ['int', 'float', 'double', 'boolean', 'char', 'void', 'String'].includes(token.value)) ||
           token.type === 'IDENTIFIER';
  }

  private parseClass(): IRClass {
    this.consume('KEYWORD', 'class');
    const nameToken = this.consume('IDENTIFIER');
    const name = nameToken?.value || 'Unknown';
    
    // Skip extends/implements
    while (this.match('KEYWORD', 'extends') || this.match('KEYWORD', 'implements')) {
      this.advance();
      this.consume('IDENTIFIER');
    }
    
    this.consume('PUNCTUATION', '{');
    
    const members: IRVariable[] = [];
    const methods: IRFunction[] = [];
    let constructor: IRFunction | undefined;
    let mainMethod: IRFunction | undefined;
    
    while (!this.match('PUNCTUATION', '}') && this.pos < this.tokens.length) {
      // Track modifiers to detect static
      let isStatic = false;
      
      // Skip modifiers but track static
      while (this.match('KEYWORD', 'public') || this.match('KEYWORD', 'private') ||
             this.match('KEYWORD', 'protected') || this.match('KEYWORD', 'static') ||
             this.match('KEYWORD', 'final')) {
        if (this.peek()?.value === 'static') {
          isStatic = true;
        }
        this.advance();
      }
      
      // Constructor
      if (this.match('IDENTIFIER', name)) {
        constructor = this.parseConstructor(name);
        continue;
      }
      
      // Method or field
      if (this.isType(this.peek())) {
        const memberOrMethod = this.parseMethodOrField();
        if (memberOrMethod?.type === 'function') {
          const func = memberOrMethod as IRFunction;
          // Check for main method
          if (func.name === 'main' && isStatic) {
            mainMethod = func;
          } else {
            methods.push(func);
          }
        } else if (memberOrMethod?.type === 'variable') {
          members.push(memberOrMethod as IRVariable);
        }
        continue;
      }
      
      // Comments
      if (this.match('COMMENT') || this.match('MULTILINE_COMMENT')) {
        this.advance();
        continue;
      }
      
      this.advance();
    }
    
    this.consume('PUNCTUATION', '}');
    
    // For Java classes with static main, we convert to a simpler structure
    // The main method content becomes the "constructor" body for procedural conversion
    const result: IRClass = { type: 'class', name, members, methods, constructor };
    
    // If there's a main method, attach it for generators to handle
    if (mainMethod) {
      (result as any).mainMethod = mainMethod;
    }
    
    return result;
  }

  private parseConstructor(className: string): IRFunction {
    this.consume('IDENTIFIER');
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    
    const body = this.parseBlock();
    
    return {
      type: 'function',
      name: '__init__',
      params,
      returnType: 'void',
      body,
    };
  }

  private parseMethodOrField(): IRNode | null {
    const typeToken = this.advance();
    if (!typeToken) return null;
    const dataType = this.mapJavaType(typeToken.value);
    
    const nameToken = this.consume('IDENTIFIER');
    if (!nameToken) return null;
    
    // Method
    if (this.match('PUNCTUATION', '(')) {
      return this.parseMethod(nameToken.value, dataType);
    }
    
    // Field
    return this.parseField(nameToken.value, dataType);
  }

  private parseMethod(name: string, returnType: DataType): IRFunction {
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    
    const body = this.parseBlock();
    
    return { type: 'function', name, params, returnType, body };
  }

  private parseField(name: string, dataType: DataType): IRVariable {
    let value: IRNode | undefined;
    
    if (this.match('PUNCTUATION', '=')) {
      this.advance();
      value = this.parseExpression();
    }
    
    this.consume('PUNCTUATION', ';');
    
    return { type: 'variable', name, dataType, value };
  }

  private parseParams(): IRVariable[] {
    const params: IRVariable[] = [];
    
    while (!this.match('PUNCTUATION', ')')) {
      const typeToken = this.advance();
      if (!typeToken) break;
      
      // Handle array params like String[]
      if (this.match('PUNCTUATION', '[')) {
        this.advance();
        this.consume('PUNCTUATION', ']');
      }
      
      const nameToken = this.consume('IDENTIFIER');
      if (nameToken) {
        params.push({
          type: 'variable',
          name: nameToken.value,
          dataType: this.mapJavaType(typeToken.value),
        });
      }
      
      if (!this.consume('PUNCTUATION', ',')) break;
    }
    
    return params;
  }

  private parseBlock(): IRNode[] {
    const statements: IRNode[] = [];
    
    if (!this.consume('PUNCTUATION', '{')) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
      return statements;
    }
    
    while (!this.match('PUNCTUATION', '}') && this.pos < this.tokens.length) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }
    
    this.consume('PUNCTUATION', '}');
    return statements;
  }

  private parseStatement(): IRNode | null {
    // Comments
    if (this.match('COMMENT')) {
      const token = this.advance()!;
      return { type: 'comment', text: token.value.trim() } as IRComment;
    }
    if (this.match('MULTILINE_COMMENT')) {
      const token = this.advance()!;
      return { type: 'comment', text: token.value.trim(), isMultiline: true } as IRComment;
    }
    
    // If
    if (this.match('KEYWORD', 'if')) {
      return this.parseIf();
    }
    
    // For
    if (this.match('KEYWORD', 'for')) {
      return this.parseFor();
    }
    
    // While
    if (this.match('KEYWORD', 'while')) {
      return this.parseWhile();
    }
    
    // Return
    if (this.match('KEYWORD', 'return')) {
      return this.parseReturn();
    }
    
    // System.out.println
    if (this.match('IDENTIFIER', 'System')) {
      return this.parsePrintln();
    }
    
    // Variable declaration
    if (this.isType(this.peek())) {
      return this.parseLocalVariable();
    }
    
    // Expression statement
    const expr = this.parseExpression();
    this.consume('PUNCTUATION', ';');
    return expr;
  }

  private parseIf(): IRIf {
    this.consume('KEYWORD', 'if');
    this.consume('PUNCTUATION', '(');
    const condition = this.parseExpression();
    this.consume('PUNCTUATION', ')');
    
    const thenBranch = this.parseBlock();
    let elseBranch: IRNode[] | undefined;
    let elseIf: IRIf | undefined;
    
    if (this.match('KEYWORD', 'else')) {
      this.advance();
      if (this.match('KEYWORD', 'if')) {
        elseIf = this.parseIf();
      } else {
        elseBranch = this.parseBlock();
      }
    }
    
    return { type: 'if', condition, thenBranch, elseBranch, elseIf };
  }

  private parseFor(): IRFor {
    this.consume('KEYWORD', 'for');
    this.consume('PUNCTUATION', '(');
    
    // Init
    let init: IRNode | undefined;
    if (!this.match('PUNCTUATION', ';')) {
      if (this.isType(this.peek())) {
        init = this.parseLocalVariable();
      } else {
        init = this.parseExpression();
        this.consume('PUNCTUATION', ';');
      }
    } else {
      this.advance();
    }
    
    // Condition
    let condition: IRNode | undefined;
    if (!this.match('PUNCTUATION', ';')) {
      condition = this.parseExpression();
    }
    this.consume('PUNCTUATION', ';');
    
    // Update
    let update: IRNode | undefined;
    if (!this.match('PUNCTUATION', ')')) {
      update = this.parseExpression();
    }
    this.consume('PUNCTUATION', ')');
    
    const body = this.parseBlock();
    
    // Extract range info
    let iterator: string | undefined;
    let rangeStart: IRNode | undefined;
    let rangeEnd: IRNode | undefined;
    let rangeStep: IRNode | undefined;
    
    if (init?.type === 'variable') {
      const varInit = init as IRVariable;
      iterator = varInit.name;
      rangeStart = varInit.value;
    }
    
    if (condition?.type === 'binary_op') {
      const binOp = condition as IRBinaryOp;
      if (binOp.operator === '<' || binOp.operator === '<=') {
        rangeEnd = binOp.right;
        if (binOp.operator === '<=') {
          rangeEnd = {
            type: 'binary_op',
            operator: '+',
            left: binOp.right,
            right: { type: 'literal', value: 1, dataType: 'int' } as IRLiteral
          } as IRBinaryOp;
        }
      }
    }
    
    // Extract step from update
    if (update?.type === 'unary_op') {
      const unary = update as IRNode & { operator: string; operand: IRNode };
      if (unary.operator === '++' || unary.operator === '++_post') {
        rangeStep = { type: 'literal', value: 1, dataType: 'int' } as IRLiteral;
      }
    } else if (update?.type === 'binary_op') {
      const binOp = update as IRBinaryOp;
      if (binOp.operator === '+=') {
        rangeStep = binOp.right;
      }
    }
    
    return {
      type: 'for',
      init,
      condition,
      update,
      iterator,
      rangeStart,
      rangeEnd,
      rangeStep,
      body,
    };
  }

  private parseWhile(): IRWhile {
    this.consume('KEYWORD', 'while');
    this.consume('PUNCTUATION', '(');
    const condition = this.parseExpression();
    this.consume('PUNCTUATION', ')');
    
    const body = this.parseBlock();
    
    return { type: 'while', condition, body };
  }

  private parseReturn(): IRReturn {
    this.consume('KEYWORD', 'return');
    
    if (this.match('PUNCTUATION', ';')) {
      this.advance();
      return { type: 'return' };
    }
    
    const value = this.parseExpression();
    this.consume('PUNCTUATION', ';');
    
    return { type: 'return', value };
  }

  private parsePrintln(): IRPrint {
    this.consume('IDENTIFIER', 'System');
    this.consume('PUNCTUATION', '.');
    this.consume('IDENTIFIER', 'out');
    this.consume('PUNCTUATION', '.');
    
    const methodToken = this.advance();
    const newline = methodToken?.value === 'println';
    
    this.consume('PUNCTUATION', '(');
    
    const args: IRNode[] = [];
    while (!this.match('PUNCTUATION', ')')) {
      args.push(this.parseExpression());
      if (!this.consume('PUNCTUATION', ',')) break;
    }
    
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', ';');
    
    return { type: 'print', args, newline };
  }

  private parseLocalVariable(): IRVariable {
    const typeToken = this.advance();
    if (!typeToken) {
      return { type: 'variable', name: 'unknown', dataType: 'int' };
    }
    
    const dataType = this.mapJavaType(typeToken.value);
    
    const nameToken = this.consume('IDENTIFIER');
    if (!nameToken) {
      return { type: 'variable', name: 'unknown', dataType };
    }
    
    let value: IRNode | undefined;
    if (this.match('PUNCTUATION', '=')) {
      this.advance();
      value = this.parseExpression();
    }
    
    this.consume('PUNCTUATION', ';');
    
    return { type: 'variable', name: nameToken.value, dataType, value };
  }

  private parseExpression(): IRNode {
    return this.parseAssignment();
  }

  private parseAssignment(): IRNode {
    const left = this.parseLogicalOr();
    
    if (this.match('PUNCTUATION', '=') || this.match('OPERATOR', '+=') ||
        this.match('OPERATOR', '-=') || this.match('OPERATOR', '*=') ||
        this.match('OPERATOR', '/=')) {
      const op = this.advance()!.value;
      const right = this.parseAssignment();
      return { type: 'binary_op', operator: op, left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseLogicalOr(): IRNode {
    let left = this.parseLogicalAnd();
    
    while (this.match('OPERATOR', '||')) {
      this.advance();
      const right = this.parseLogicalAnd();
      left = { type: 'binary_op', operator: '||', left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseLogicalAnd(): IRNode {
    let left = this.parseComparison();
    
    while (this.match('OPERATOR', '&&')) {
      this.advance();
      const right = this.parseComparison();
      left = { type: 'binary_op', operator: '&&', left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseComparison(): IRNode {
    let left = this.parseAddSub();
    
    while (this.match('OPERATOR', '==') || this.match('OPERATOR', '!=') ||
           this.match('PUNCTUATION', '<') || this.match('PUNCTUATION', '>') ||
           this.match('OPERATOR', '<=') || this.match('OPERATOR', '>=')) {
      const op = this.advance()!.value;
      const right = this.parseAddSub();
      left = { type: 'binary_op', operator: op, left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseAddSub(): IRNode {
    let left = this.parseMulDiv();
    
    while (this.match('PUNCTUATION', '+') || this.match('PUNCTUATION', '-')) {
      const op = this.advance()!.value;
      const right = this.parseMulDiv();
      left = { type: 'binary_op', operator: op, left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseMulDiv(): IRNode {
    let left = this.parseUnary();
    
    while (this.match('PUNCTUATION', '*') || this.match('PUNCTUATION', '/') ||
           this.match('PUNCTUATION', '%')) {
      const op = this.advance()!.value;
      const right = this.parseUnary();
      left = { type: 'binary_op', operator: op, left, right } as IRBinaryOp;
    }
    
    return left;
  }

  private parseUnary(): IRNode {
    if (this.match('PUNCTUATION', '!') || this.match('PUNCTUATION', '-') ||
        this.match('OPERATOR', '++') || this.match('OPERATOR', '--')) {
      const op = this.advance()!.value;
      const operand = this.parseUnary();
      return { type: 'unary_op', operator: op, operand } as IRNode & { operator: string; operand: IRNode };
    }
    
    return this.parsePostfix();
  }

  private parsePostfix(): IRNode {
    let expr = this.parsePrimary();
    
    while (true) {
      if (this.match('OPERATOR', '++') || this.match('OPERATOR', '--')) {
        const op = this.advance()!.value;
        expr = { type: 'unary_op', operator: op + '_post', operand: expr } as IRNode & { operator: string; operand: IRNode };
      } else if (this.match('PUNCTUATION', '.')) {
        this.advance();
        const member = this.consume('IDENTIFIER');
        
        if (this.match('PUNCTUATION', '(')) {
          this.advance();
          const args: IRNode[] = [];
          while (!this.match('PUNCTUATION', ')')) {
            args.push(this.parseExpression());
            if (!this.consume('PUNCTUATION', ',')) break;
          }
          this.consume('PUNCTUATION', ')');
          
          const objName = expr.type === 'identifier' ? (expr as IRIdentifier).name : 'obj';
          expr = {
            type: 'call',
            callee: member?.value || '',
            args,
            isMethod: true,
            object: objName,
          } as IRCall;
        }
      } else {
        break;
      }
    }
    
    return expr;
  }

  private parsePrimary(): IRNode {
    // Parenthesized
    if (this.match('PUNCTUATION', '(')) {
      this.advance();
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return expr;
    }
    
    // new keyword
    if (this.match('KEYWORD', 'new')) {
      this.advance();
      const className = this.consume('IDENTIFIER')?.value || 'Object';
      this.consume('PUNCTUATION', '(');
      const args: IRNode[] = [];
      while (!this.match('PUNCTUATION', ')')) {
        args.push(this.parseExpression());
        if (!this.consume('PUNCTUATION', ',')) break;
      }
      this.consume('PUNCTUATION', ')');
      return { type: 'call', callee: className, args } as IRCall;
    }
    
    // Scanner input
    if (this.match('IDENTIFIER', 'scanner') || this.match('IDENTIFIER', 'sc') ||
        this.match('IDENTIFIER', 'input')) {
      const scanner = this.advance()!.value;
      this.consume('PUNCTUATION', '.');
      const method = this.advance()?.value || 'nextLine';
      this.consume('PUNCTUATION', '(');
      this.consume('PUNCTUATION', ')');
      
      let targetType: DataType = 'string';
      if (method === 'nextInt') targetType = 'int';
      else if (method === 'nextFloat' || method === 'nextDouble') targetType = 'float';
      
      return { type: 'input', targetType } as IRInput;
    }
    
    // String literal
    if (this.match('STRING')) {
      const token = this.advance()!;
      return { type: 'literal', value: token.value.slice(1, -1), dataType: 'string' } as IRLiteral;
    }
    
    // Char literal
    if (this.match('CHAR')) {
      const token = this.advance()!;
      return { type: 'literal', value: token.value.slice(1, -1), dataType: 'char' } as IRLiteral;
    }
    
    // Number
    if (this.match('NUMBER')) {
      const token = this.advance()!;
      const value = token.value.replace(/[fFdDlL]/g, '');
      const isFloat = value.includes('.') || token.value.toLowerCase().includes('f');
      return {
        type: 'literal',
        value: isFloat ? parseFloat(value) : parseInt(value),
        dataType: isFloat ? 'float' : 'int',
      } as IRLiteral;
    }
    
    // Boolean
    if (this.match('KEYWORD', 'true')) {
      this.advance();
      return { type: 'literal', value: true, dataType: 'bool' } as IRLiteral;
    }
    if (this.match('KEYWORD', 'false')) {
      this.advance();
      return { type: 'literal', value: false, dataType: 'bool' } as IRLiteral;
    }
    
    // null
    if (this.match('KEYWORD', 'null')) {
      this.advance();
      return { type: 'literal', value: 'null', dataType: 'void' } as IRLiteral;
    }
    
    // this
    if (this.match('KEYWORD', 'this')) {
      this.advance();
      return { type: 'identifier', name: 'this' } as IRIdentifier;
    }
    
    // Identifier or function call
    if (this.match('IDENTIFIER') || this.match('KEYWORD')) {
      const token = this.advance()!;
      
      // Function call
      if (this.match('PUNCTUATION', '(')) {
        this.advance();
        const args: IRNode[] = [];
        while (!this.match('PUNCTUATION', ')')) {
          args.push(this.parseExpression());
          if (!this.consume('PUNCTUATION', ',')) break;
        }
        this.consume('PUNCTUATION', ')');
        return { type: 'call', callee: token.value, args } as IRCall;
      }
      
      return { type: 'identifier', name: token.value } as IRIdentifier;
    }
    
    this.advance();
    return { type: 'literal', value: '', dataType: 'string' } as IRLiteral;
  }

  private mapJavaType(type: string): DataType {
    const typeMap: Record<string, DataType> = {
      'int': 'int',
      'float': 'float',
      'double': 'double',
      'boolean': 'bool',
      'char': 'char',
      'void': 'void',
      'String': 'string',
    };
    return typeMap[type] || 'auto';
  }
}
