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

export class CppParser {
  private tokens: Token[] = [];
  private pos = 0;

  parse(code: string): IRProgram {
    try {
      this.tokens = this.tokenize(code);
      this.pos = 0;
      
      const body: IRNode[] = [];
      const imports: string[] = [];
      
      while (this.pos < this.tokens.length) {
        // Preprocessor
        if (this.match('PREPROCESSOR')) {
          const directive = this.advance()!.value;
          imports.push(directive);
          continue;
        }
        
        // using namespace
        if (this.match('KEYWORD', 'using')) {
          while (!this.match('PUNCTUATION', ';') && this.pos < this.tokens.length) {
            this.advance();
          }
          this.consume('PUNCTUATION', ';');
          continue;
        }
        
        const node = this.parseTopLevel();
        if (node) body.push(node);
      }
      
      return { type: 'program', body, imports };
    } catch (error) {
      console.error('C++ parser error:', error);
      return { type: 'program', body: [], imports: [] };
    }
  }

  private tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    
    while (i < code.length) {
      if (/\s/.test(code[i])) {
        i++;
        continue;
      }
      
      // Preprocessor
      if (code[i] === '#') {
        let directive = '';
        while (i < code.length && code[i] !== '\n') {
          directive += code[i++];
        }
        tokens.push({ type: 'PREPROCESSOR', value: directive });
        continue;
      }
      
      // Comments
      if (code.slice(i, i + 2) === '//') {
        let comment = '';
        i += 2;
        while (i < code.length && code[i] !== '\n') {
          comment += code[i++];
        }
        tokens.push({ type: 'COMMENT', value: comment });
        continue;
      }
      
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
      
      // Strings
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
      
      // Chars
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
      const numMatch = code.slice(i).match(/^\d+\.?\d*[fFlL]?/);
      if (numMatch) {
        tokens.push({ type: 'NUMBER', value: numMatch[0] });
        i += numMatch[0].length;
        continue;
      }
      
      // Words
      const wordMatch = code.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
      if (wordMatch) {
        const keywords = ['int', 'float', 'double', 'char', 'void', 'bool', 'auto',
                         'if', 'else', 'for', 'while', 'switch', 'case', 'default', 'break',
                         'return', 'class', 'struct', 'public', 'private', 'protected', 
                         'const', 'static', 'virtual', 'new', 'delete', 'this', 'nullptr', 
                         'true', 'false', 'using', 'namespace', 'std', 'cout', 'cin', 'endl', 'string'];
        const type = keywords.includes(wordMatch[0]) ? 'KEYWORD' : 'IDENTIFIER';
        tokens.push({ type, value: wordMatch[0] });
        i += wordMatch[0].length;
        continue;
      }
      
      // Operators
      const opMatch = code.slice(i).match(/^(<<|>>|==|!=|<=|>=|&&|\|\||\+\+|--|->|::|->|\+=|-=|\*=|\/=)/);
      if (opMatch) {
        tokens.push({ type: 'OPERATOR', value: opMatch[0] });
        i += opMatch[0].length;
        continue;
      }
      
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
    
    // Class
    if (this.match('KEYWORD', 'class')) {
      return this.parseClass();
    }
    
    // Function or variable
    if (this.isType(this.peek())) {
      return this.parseFunctionOrVariable();
    }
    
    this.advance();
    return null;
  }

  private isType(token: Token | null): boolean {
    if (!token) return false;
    // Only treat known type keywords as types, NOT arbitrary identifiers
    const typeKeywords = ['int', 'float', 'double', 'char', 'void', 'bool', 'auto', 'const', 'static', 'string', 'unsigned', 'signed', 'long', 'short'];
    return (token.type === 'KEYWORD' && typeKeywords.includes(token.value)) ||
           (token.type === 'IDENTIFIER' && token.value === 'string') ||
           (token.type === 'IDENTIFIER' && token.value === 'std'); // std:: types
  }

  private parseClass(): IRClass {
    this.consume('KEYWORD', 'class');
    const nameToken = this.consume('IDENTIFIER');
    const name = nameToken?.value || 'Unknown';
    
    this.consume('PUNCTUATION', '{');
    
    const members: IRVariable[] = [];
    const methods: IRFunction[] = [];
    let constructor: IRFunction | undefined;
    
    while (!this.match('PUNCTUATION', '}') && this.pos < this.tokens.length) {
      // Access specifiers
      if (this.match('KEYWORD', 'public') || this.match('KEYWORD', 'private') ||
          this.match('KEYWORD', 'protected')) {
        this.advance();
        this.consume('PUNCTUATION', ':');
        continue;
      }
      
      // Constructor
      if (this.match('IDENTIFIER', name)) {
        constructor = this.parseConstructor(name);
        continue;
      }
      
      // Member or method
      if (this.isType(this.peek())) {
        const memberOrMethod = this.parseMemberOrMethod();
        if (memberOrMethod?.type === 'function') {
          methods.push(memberOrMethod as IRFunction);
        } else if (memberOrMethod?.type === 'variable') {
          members.push(memberOrMethod as IRVariable);
        }
        continue;
      }
      
      if (this.match('COMMENT') || this.match('MULTILINE_COMMENT')) {
        this.advance();
        continue;
      }
      
      this.advance();
    }
    
    this.consume('PUNCTUATION', '}');
    this.consume('PUNCTUATION', ';');
    
    return { type: 'class', name, members, methods, constructor };
  }

  private parseConstructor(className: string): IRFunction {
    this.consume('IDENTIFIER');
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    
    // Skip initializer list
    if (this.match('PUNCTUATION', ':')) {
      while (!this.match('PUNCTUATION', '{') && this.pos < this.tokens.length) {
        this.advance();
      }
    }
    
    const body = this.parseBlock();
    
    return { type: 'function', name: '__init__', params, returnType: 'void', body };
  }

  private parseMemberOrMethod(): IRNode | null {
    // Skip modifiers
    while (this.match('KEYWORD', 'const') || this.match('KEYWORD', 'static') ||
           this.match('KEYWORD', 'virtual')) {
      this.advance();
    }
    
    const typeToken = this.advance();
    if (!typeToken) return null;
    
    let dataType = this.mapCppType(typeToken.value);
    
    // Handle std::string
    if (typeToken.value === 'std' && this.match('OPERATOR', '::')) {
      this.advance();
      const subType = this.advance();
      dataType = this.mapCppType(subType?.value || '');
    }
    
    // Pointer/reference
    this.consume('PUNCTUATION', '*');
    this.consume('PUNCTUATION', '&');
    
    const nameToken = this.consume('IDENTIFIER');
    if (!nameToken) return null;
    
    // Method
    if (this.match('PUNCTUATION', '(')) {
      return this.parseMethod(nameToken.value, dataType);
    }
    
    // Member
    return this.parseMember(nameToken.value, dataType);
  }

  private parseMethod(name: string, returnType: DataType): IRFunction {
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    
    // Skip const qualifier
    this.consume('KEYWORD', 'const');
    
    const body = this.parseBlock();
    
    return { type: 'function', name, params, returnType, body };
  }

  private parseMember(name: string, dataType: DataType): IRVariable {
    let value: IRNode | undefined;
    
    if (this.match('PUNCTUATION', '=')) {
      this.advance();
      value = this.parseExpression();
    }
    
    this.consume('PUNCTUATION', ';');
    
    return { type: 'variable', name, dataType, value };
  }

  private parseFunctionOrVariable(): IRNode | null {
    while (this.match('KEYWORD', 'const') || this.match('KEYWORD', 'static')) {
      this.advance();
    }
    
    const typeToken = this.advance();
    if (!typeToken) return null;
    
    let dataType = this.mapCppType(typeToken.value);
    
    // std::string
    if (typeToken.value === 'std' && this.match('OPERATOR', '::')) {
      this.advance();
      const subType = this.advance();
      dataType = this.mapCppType(subType?.value || '');
    }
    
    this.consume('PUNCTUATION', '*');
    this.consume('PUNCTUATION', '&');
    
    const nameToken = this.consume('IDENTIFIER');
    if (!nameToken) return null;
    
    // Function
    if (this.match('PUNCTUATION', '(')) {
      return this.parseFunctionDef(nameToken.value, dataType);
    }
    
    // Variable
    return this.parseVariableDecl(nameToken.value, dataType);
  }

  private parseFunctionDef(name: string, returnType: DataType): IRFunction {
    this.consume('PUNCTUATION', '(');
    const params = this.parseParams();
    this.consume('PUNCTUATION', ')');
    
    const body = this.parseBlock();
    
    return { type: 'function', name, params, returnType, body };
  }

  private parseParams(): IRVariable[] {
    const params: IRVariable[] = [];
    
    while (!this.match('PUNCTUATION', ')')) {
      let typeToken = this.advance();
      if (!typeToken) break;
      
      let dataType = this.mapCppType(typeToken.value);
      
      if (typeToken.value === 'std' && this.match('OPERATOR', '::')) {
        this.advance();
        const subType = this.advance();
        dataType = this.mapCppType(subType?.value || '');
      }
      
      this.consume('PUNCTUATION', '*');
      this.consume('PUNCTUATION', '&');
      
      const nameToken = this.consume('IDENTIFIER');
      if (nameToken) {
        params.push({ type: 'variable', name: nameToken.value, dataType });
      }
      
      if (!this.consume('PUNCTUATION', ',')) break;
    }
    
    return params;
  }

  private parseVariableDecl(name: string, dataType: DataType): IRVariable {
    let value: IRNode | undefined;
    
    if (this.match('PUNCTUATION', '=')) {
      this.advance();
      value = this.parseExpression();
    }
    
    this.consume('PUNCTUATION', ';');
    
    return { type: 'variable', name, dataType, value };
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
    if (this.match('COMMENT')) {
      const token = this.advance()!;
      return { type: 'comment', text: token.value.trim() } as IRComment;
    }
    if (this.match('MULTILINE_COMMENT')) {
      const token = this.advance()!;
      return { type: 'comment', text: token.value.trim(), isMultiline: true } as IRComment;
    }
    
    if (this.match('KEYWORD', 'if')) return this.parseIf();
    if (this.match('KEYWORD', 'for')) return this.parseFor();
    if (this.match('KEYWORD', 'while')) return this.parseWhile();
    if (this.match('KEYWORD', 'switch')) return this.parseSwitch();
    if (this.match('KEYWORD', 'break')) {
      this.advance();
      this.consume('PUNCTUATION', ';');
      return { type: 'break' } as IRNode;
    }
    if (this.match('KEYWORD', 'return')) return this.parseReturn();
    
    // cout
    if (this.match('KEYWORD', 'std')) {
      const next = this.peek(1);
      if (next?.value === '::') {
        const third = this.peek(2);
        if (third?.value === 'cout') return this.parseCout();
        if (third?.value === 'cin') return this.parseCin();
      }
    }
    if (this.match('KEYWORD', 'cout')) return this.parseCout();
    if (this.match('KEYWORD', 'cin')) return this.parseCin();
    
    // Variable declaration
    if (this.isType(this.peek())) {
      return this.parseLocalVariable();
    }
    
    const expr = this.parseExpression();
    this.consume('PUNCTUATION', ';');
    return expr;
  }
  
  private parseSwitch(): IRNode {
    this.consume('KEYWORD', 'switch');
    this.consume('PUNCTUATION', '(');
    const expression = this.parseExpression();
    this.consume('PUNCTUATION', ')');
    this.consume('PUNCTUATION', '{');
    
    const cases: { value: IRNode; body: IRNode[] }[] = [];
    let defaultBody: IRNode[] | undefined;
    
    while (!this.match('PUNCTUATION', '}') && this.pos < this.tokens.length) {
      if (this.match('KEYWORD', 'case')) {
        this.advance();
        const value = this.parseExpression();
        this.consume('PUNCTUATION', ':');
        
        const body: IRNode[] = [];
        while (!this.match('KEYWORD', 'case') && !this.match('KEYWORD', 'default') && 
               !this.match('PUNCTUATION', '}') && this.pos < this.tokens.length) {
          if (this.match('KEYWORD', 'break')) {
            this.advance();
            this.consume('PUNCTUATION', ';');
            break;
          }
          const stmt = this.parseStatement();
          if (stmt) body.push(stmt);
        }
        cases.push({ value, body });
      } else if (this.match('KEYWORD', 'default')) {
        this.advance();
        this.consume('PUNCTUATION', ':');
        
        defaultBody = [];
        while (!this.match('KEYWORD', 'case') && !this.match('PUNCTUATION', '}') && this.pos < this.tokens.length) {
          if (this.match('KEYWORD', 'break')) {
            this.advance();
            this.consume('PUNCTUATION', ';');
            break;
          }
          const stmt = this.parseStatement();
          if (stmt) defaultBody.push(stmt);
        }
      } else {
        this.advance();
      }
    }
    
    this.consume('PUNCTUATION', '}');
    
    return { type: 'switch', expression, cases, defaultBody } as IRNode;
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
    
    let condition: IRNode | undefined;
    if (!this.match('PUNCTUATION', ';')) {
      condition = this.parseExpression();
    }
    this.consume('PUNCTUATION', ';');
    
    let update: IRNode | undefined;
    if (!this.match('PUNCTUATION', ')')) {
      update = this.parseExpression();
    }
    this.consume('PUNCTUATION', ')');
    
    const body = this.parseBlock();
    
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
    
    return { type: 'for', init, condition, update, iterator, rangeStart, rangeEnd, rangeStep, body };
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

  private parseCout(): IRPrint {
    // Skip std::
    if (this.match('KEYWORD', 'std')) {
      this.advance();
      this.consume('OPERATOR', '::');
    }
    this.consume('KEYWORD', 'cout');
    
    const args: IRNode[] = [];
    let newline = false;
    
    while (this.match('OPERATOR', '<<')) {
      this.advance();
      
      // Check for endl
      if (this.match('KEYWORD', 'endl') || this.match('KEYWORD', 'std')) {
        if (this.match('KEYWORD', 'std')) {
          this.advance();
          this.consume('OPERATOR', '::');
        }
        if (this.match('KEYWORD', 'endl')) {
          this.advance();
          newline = true;
          continue;
        }
      }
      
      args.push(this.parseExpression());
    }
    
    this.consume('PUNCTUATION', ';');
    
    return { type: 'print', args, newline };
  }

  private parseCin(): IRInput {
    if (this.match('KEYWORD', 'std')) {
      this.advance();
      this.consume('OPERATOR', '::');
    }
    this.consume('KEYWORD', 'cin');
    
    this.consume('OPERATOR', '>>');
    
    let targetVar: string | undefined;
    if (this.match('IDENTIFIER')) {
      targetVar = this.advance()!.value;
    }
    
    this.consume('PUNCTUATION', ';');
    
    return { type: 'input', targetVar };
  }

  private parseLocalVariable(): IRVariable {
    while (this.match('KEYWORD', 'const') || this.match('KEYWORD', 'static')) {
      this.advance();
    }
    
    const typeToken = this.advance();
    if (!typeToken) {
      return { type: 'variable', name: 'unknown', dataType: 'int' };
    }
    
    let dataType = this.mapCppType(typeToken.value);
    
    if (typeToken.value === 'std' && this.match('OPERATOR', '::')) {
      this.advance();
      const subType = this.advance();
      dataType = this.mapCppType(subType?.value || '');
    }
    
    this.consume('PUNCTUATION', '*');
    this.consume('PUNCTUATION', '&');
    
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
      left = { type: 'binary_op', operator: '||', left, right: this.parseLogicalAnd() } as IRBinaryOp;
    }
    return left;
  }

  private parseLogicalAnd(): IRNode {
    let left = this.parseComparison();
    while (this.match('OPERATOR', '&&')) {
      this.advance();
      left = { type: 'binary_op', operator: '&&', left, right: this.parseComparison() } as IRBinaryOp;
    }
    return left;
  }

  private parseComparison(): IRNode {
    let left = this.parseAddSub();
    while (this.match('OPERATOR', '==') || this.match('OPERATOR', '!=') ||
           this.match('PUNCTUATION', '<') || this.match('PUNCTUATION', '>') ||
           this.match('OPERATOR', '<=') || this.match('OPERATOR', '>=')) {
      const op = this.advance()!.value;
      left = { type: 'binary_op', operator: op, left, right: this.parseAddSub() } as IRBinaryOp;
    }
    return left;
  }

  private parseAddSub(): IRNode {
    let left = this.parseMulDiv();
    while (this.match('PUNCTUATION', '+') || this.match('PUNCTUATION', '-')) {
      const op = this.advance()!.value;
      left = { type: 'binary_op', operator: op, left, right: this.parseMulDiv() } as IRBinaryOp;
    }
    return left;
  }

  private parseMulDiv(): IRNode {
    let left = this.parseUnary();
    while (this.match('PUNCTUATION', '*') || this.match('PUNCTUATION', '/') ||
           this.match('PUNCTUATION', '%')) {
      const op = this.advance()!.value;
      left = { type: 'binary_op', operator: op, left, right: this.parseUnary() } as IRBinaryOp;
    }
    return left;
  }

  private parseUnary(): IRNode {
    if (this.match('PUNCTUATION', '!') || this.match('PUNCTUATION', '-') ||
        this.match('OPERATOR', '++') || this.match('OPERATOR', '--')) {
      const op = this.advance()!.value;
      return { type: 'unary_op', operator: op, operand: this.parseUnary() } as IRNode & { operator: string; operand: IRNode };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): IRNode {
    let expr = this.parsePrimary();
    while (this.match('OPERATOR', '++') || this.match('OPERATOR', '--')) {
      const op = this.advance()!.value;
      expr = { type: 'unary_op', operator: op + '_post', operand: expr } as IRNode & { operator: string; operand: IRNode };
    }
    return expr;
  }

  private parsePrimary(): IRNode {
    if (this.match('PUNCTUATION', '(')) {
      this.advance();
      const expr = this.parseExpression();
      this.consume('PUNCTUATION', ')');
      return expr;
    }
    
    if (this.match('STRING')) {
      const token = this.advance()!;
      return { type: 'literal', value: token.value.slice(1, -1), dataType: 'string' } as IRLiteral;
    }
    
    if (this.match('CHAR')) {
      const token = this.advance()!;
      return { type: 'literal', value: token.value.slice(1, -1), dataType: 'char' } as IRLiteral;
    }
    
    if (this.match('NUMBER')) {
      const token = this.advance()!;
      const value = token.value.replace(/[fFlL]/g, '');
      const isFloat = value.includes('.');
      return { type: 'literal', value: isFloat ? parseFloat(value) : parseInt(value), dataType: isFloat ? 'float' : 'int' } as IRLiteral;
    }
    
    if (this.match('KEYWORD', 'true')) {
      this.advance();
      return { type: 'literal', value: true, dataType: 'bool' } as IRLiteral;
    }
    if (this.match('KEYWORD', 'false')) {
      this.advance();
      return { type: 'literal', value: false, dataType: 'bool' } as IRLiteral;
    }
    if (this.match('KEYWORD', 'nullptr')) {
      this.advance();
      return { type: 'literal', value: 'null', dataType: 'void' } as IRLiteral;
    }
    
    if (this.match('IDENTIFIER') || this.match('KEYWORD')) {
      const token = this.advance()!;
      
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
    
    // Skip unknown token and return empty
    this.advance();
    return { type: 'literal', value: '', dataType: 'string' } as IRLiteral;
  }

  private mapCppType(type: string): DataType {
    const typeMap: Record<string, DataType> = {
      'int': 'int',
      'float': 'float',
      'double': 'double',
      'char': 'char',
      'void': 'void',
      'bool': 'bool',
      'auto': 'auto',
      'string': 'string',
    };
    return typeMap[type] || 'auto';
  }
}
