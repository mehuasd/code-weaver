import {
  IRNode,
  IRProgram,
  IRVariable,
  IRFunction,
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

export class CParser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(code: string): IRProgram {
    this.tokens = this.tokenize(code);
    this.pos = 0;
    
    const body: IRNode[] = [];
    const imports: string[] = [];
    
    while (this.pos < this.tokens.length) {
      // Skip preprocessor directives
      if (this.match('PREPROCESSOR')) {
        const directive = this.advance()!.value;
        if (directive.includes('include')) {
          imports.push(directive);
        }
        continue;
      }
      
      const node = this.parseTopLevel();
      if (node) body.push(node);
    }
    
    return { type: 'program', body, imports };
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
      
      // Preprocessor directives
      if (code[i] === '#') {
        let directive = '';
        while (i < code.length && code[i] !== '\n') {
          directive += code[i++];
        }
        tokens.push({ type: 'PREPROCESSOR', value: directive });
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
          str += code[i++];
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
          char += code[i++];
        }
        char += "'";
        i++;
        tokens.push({ type: 'CHAR', value: char });
        continue;
      }
      
      // Numbers
      const numMatch = code.slice(i).match(/^\d+\.?\d*[fFlL]?/);
      if (numMatch) {
        tokens.push({ type: 'NUMBER', value: numMatch[0] });
        i += numMatch[0].length;
        continue;
      }
      
      // Keywords and identifiers
      const wordMatch = code.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (wordMatch) {
        const keywords = ['int', 'float', 'double', 'char', 'void', 'if', 'else', 'for', 
                         'while', 'return', 'struct', 'typedef', 'const', 'static',
                         'printf', 'scanf', 'sizeof', 'NULL', 'true', 'false'];
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
    
    // Check for function or variable
    const typeToken = this.peek();
    if (!typeToken) return null;
    
    if (this.isType(typeToken)) {
      return this.parseFunctionOrVariable();
    }
    
    // Skip unknown tokens
    this.advance();
    return null;
  }

  private isType(token: Token): boolean {
    return token.type === 'KEYWORD' && 
           ['int', 'float', 'double', 'char', 'void', 'const', 'static'].includes(token.value);
  }

  private parseFunctionOrVariable(): IRNode | null {
    // Skip modifiers
    while (this.match('KEYWORD', 'const') || this.match('KEYWORD', 'static')) {
      this.advance();
    }
    
    const typeToken = this.advance();
    if (!typeToken) return null;
    const dataType = this.mapCType(typeToken.value);
    
    // Check for pointer
    let isPointer = false;
    if (this.match('PUNCTUATION', '*')) {
      this.advance();
      isPointer = true;
    }
    
    const nameToken = this.consume('IDENTIFIER');
    if (!nameToken) return null;
    
    // Function definition
    if (this.match('PUNCTUATION', '(')) {
      return this.parseFunctionDef(nameToken.value, dataType);
    }
    
    // Variable declaration
    return this.parseVariableDecl(nameToken.value, dataType);
  }

  private parseFunctionDef(name: string, returnType: DataType): IRFunction {
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    
    const body = this.parseBlock();
    
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
      const typeToken = this.advance();
      if (!typeToken) break;
      
      // Skip pointer asterisk
      this.consume('PUNCTUATION', '*');
      
      const nameToken = this.consume('IDENTIFIER');
      if (nameToken) {
        params.push({
          type: 'variable',
          name: nameToken.value,
          dataType: this.mapCType(typeToken.value),
        });
      }
      
      // Handle array parameters
      if (this.match('PUNCTUATION', '[')) {
        while (!this.match('PUNCTUATION', ']') && this.pos < this.tokens.length) {
          this.advance();
        }
        this.consume('PUNCTUATION', ']');
      }
      
      if (!this.consume('PUNCTUATION', ',')) break;
    }
    
    return params;
  }

  private parseBlock(): IRNode[] {
    const statements: IRNode[] = [];
    
    if (!this.consume('PUNCTUATION', '{')) {
      // Single statement block
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
    
    // Return
    if (this.match('KEYWORD', 'return')) {
      return this.parseReturn();
    }
    
    // Printf
    if (this.match('KEYWORD', 'printf')) {
      return this.parsePrintf();
    }
    
    // Scanf
    if (this.match('KEYWORD', 'scanf')) {
      return this.parseScanf();
    }
    
    // Variable declaration
    if (this.isType(this.peek()!)) {
      return this.parseVariableDecl();
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
      if (this.isType(this.peek()!)) {
        init = this.parseVariableDecl();
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
    
    // Try to extract range info from classic for loop
    let iterator: string | undefined;
    let rangeStart: IRNode | undefined;
    let rangeEnd: IRNode | undefined;
    
    if (init?.type === 'variable') {
      const varInit = init as IRVariable;
      iterator = varInit.name;
      rangeStart = varInit.value;
    }
    
    if (condition?.type === 'binary_op') {
      const binOp = condition as IRBinaryOp;
      if (binOp.operator === '<' || binOp.operator === '<=') {
        rangeEnd = binOp.right;
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

  private parsePrintf(): IRPrint {
    this.consume('KEYWORD', 'printf');
    this.consume('PUNCTUATION', '(');
    
    const args: IRNode[] = [];
    
    // Format string
    if (this.match('STRING')) {
      const formatStr = this.advance()!.value;
      const cleanStr = formatStr.slice(1, -1); // Remove quotes
      args.push({ type: 'literal', value: cleanStr, dataType: 'string' } as IRLiteral);
    }
    
    // Additional arguments
    while (this.match('PUNCTUATION', ',')) {
      this.advance();
      args.push(this.parseExpression());
    }
    
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', ';');
    
    // Check for newline
    const hasNewline = args.length > 0 && 
      args[0].type === 'literal' && 
      (args[0] as IRLiteral).value.toString().includes('\\n');
    
    return { type: 'print', args, newline: hasNewline };
  }

  private parseScanf(): IRInput {
    this.consume('KEYWORD', 'scanf');
    this.consume('PUNCTUATION', '(');
    
    let targetType: DataType = 'string';
    
    // Format string
    if (this.match('STRING')) {
      const format = this.advance()!.value;
      if (format.includes('%d') || format.includes('%i')) targetType = 'int';
      else if (format.includes('%f') || format.includes('%lf')) targetType = 'float';
      else if (format.includes('%s')) targetType = 'string';
    }
    
    this.consume('PUNCTUATION', ',');
    
    // Skip &
    this.consume('PUNCTUATION', '&');
    
    let targetVar: string | undefined;
    if (this.match('IDENTIFIER')) {
      targetVar = this.advance()!.value;
    }
    
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', ';');
    
    return { type: 'input', targetVar, targetType };
  }

  private parseVariableDecl(name?: string, dataType?: DataType): IRVariable | null {
    if (!dataType) {
      const typeToken = this.advance();
      if (!typeToken) return null;
      dataType = this.mapCType(typeToken.value);
    }
    
    // Skip pointer
    this.consume('PUNCTUATION', '*');
    
    if (!name) {
      const nameToken = this.consume('IDENTIFIER');
      if (!nameToken) return null;
      name = nameToken.value;
    }
    
    // Array declaration
    if (this.match('PUNCTUATION', '[')) {
      while (!this.match('PUNCTUATION', ']') && this.pos < this.tokens.length) {
        this.advance();
      }
      this.consume('PUNCTUATION', ']');
    }
    
    let value: IRNode | undefined;
    if (this.match('PUNCTUATION', '=')) {
      this.advance();
      value = this.parseExpression();
    }
    
    this.consume('PUNCTUATION', ';');
    
    return { type: 'variable', name, dataType, value };
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
      
      if (left.type === 'identifier') {
        return {
          type: 'binary_op',
          operator: op,
          left,
          right,
        } as IRBinaryOp;
      }
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
      } else {
        break;
      }
    }
    
    return expr;
  }

  private parsePrimary(): IRNode {
    // Parenthesized expression
    if (this.match('PUNCTUATION', '(')) {
      this.advance();
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return expr;
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
      const value = token.value.replace(/[fFlL]/g, '');
      const isFloat = value.includes('.') || token.value.includes('f');
      return {
        type: 'literal',
        value: isFloat ? parseFloat(value) : parseInt(value),
        dataType: isFloat ? 'float' : 'int',
      } as IRLiteral;
    }
    
    // NULL
    if (this.match('KEYWORD', 'NULL')) {
      this.advance();
      return { type: 'literal', value: 'null', dataType: 'void' } as IRLiteral;
    }
    
    // true/false
    if (this.match('KEYWORD', 'true')) {
      this.advance();
      return { type: 'literal', value: true, dataType: 'bool' } as IRLiteral;
    }
    if (this.match('KEYWORD', 'false')) {
      this.advance();
      return { type: 'literal', value: false, dataType: 'bool' } as IRLiteral;
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
    
    // Fallback
    this.advance();
    return { type: 'literal', value: '', dataType: 'string' } as IRLiteral;
  }

  private mapCType(type: string): DataType {
    const typeMap: Record<string, DataType> = {
      'int': 'int',
      'float': 'float',
      'double': 'double',
      'char': 'char',
      'void': 'void',
      'bool': 'bool',
    };
    return typeMap[type] || 'auto';
  }
}
