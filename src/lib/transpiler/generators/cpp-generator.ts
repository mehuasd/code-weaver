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
  IRUnaryOp,
  IRLiteral,
  IRIdentifier,
  IRComment,
  IRAssignment,
  DataType,
  isIRVariable,
  isIRFunction,
  isIRClass,
  isIRIf,
  isIRFor,
  isIRWhile,
  isIRReturn,
  isIRPrint,
  isIRInput,
  isIRCall,
  isIRBinaryOp,
  isIRLiteral,
  isIRIdentifier,
  isIRComment,
  isIRAssignment,
} from '../ir';

export class CppGenerator {
  private indent = 0;
  private indentStr = '    ';
  private usesIostream = false;
  private usesString = false;

  generate(ir: IRProgram): string {
    this.indent = 0;
    this.usesIostream = false;
    this.usesString = false;
    
    this.analyzeProgram(ir);
    
    const lines: string[] = [];
    
    // Includes
    if (this.usesIostream) lines.push('#include <iostream>');
    if (this.usesString) lines.push('#include <string>');
    if (lines.length > 0) {
      lines.push('');
      lines.push('using namespace std;');
      lines.push('');
    }
    
    // Separate functions/classes from main content
    const functions = ir.body.filter(n => isIRFunction(n));
    const classes = ir.body.filter(n => isIRClass(n));
    const mainContent = ir.body.filter(n => !isIRFunction(n) && !isIRClass(n));
    
    // Generate classes first
    for (const node of classes) {
      const code = this.generateNode(node);
      if (code) lines.push(code);
    }
    
    // Generate functions (but wrap 'main' in int main)
    let hasReturnInMain = false;
    for (const func of functions) {
      const f = func as IRFunction;
      if (f.name === 'main') {
        lines.push('int main() {');
        this.indent++;
        for (const stmt of f.body) {
          if (stmt.type === 'return') hasReturnInMain = true;
          const code = this.generateNode(stmt);
          if (code) lines.push(code);
        }
        if (!hasReturnInMain) {
          lines.push(`${this.getIndent()}return 0;`);
        }
        this.indent--;
        lines.push('}');
      } else {
        const code = this.generateNode(func);
        if (code) lines.push(code);
      }
    }
    
    // If there's main content but no main function, wrap in int main()
    if (mainContent.length > 0 && !functions.some(f => (f as IRFunction).name === 'main')) {
      lines.push('int main() {');
      this.indent++;
      for (const node of mainContent) {
        const code = this.generateNode(node);
        if (code) lines.push(code);
      }
      lines.push(`${this.getIndent()}return 0;`);
      this.indent--;
      lines.push('}');
    }
    
    return lines.join('\n');
  }

  private analyzeProgram(ir: IRProgram): void {
    const analyze = (node: IRNode) => {
      if (isIRPrint(node) || isIRInput(node)) this.usesIostream = true;
      if (isIRVariable(node) && node.dataType === 'string') this.usesString = true;
      if (isIRFunction(node)) {
        node.body.forEach(analyze);
        node.params.forEach(p => { if (p.dataType === 'string') this.usesString = true; });
      }
      if (isIRClass(node)) {
        node.members.forEach(analyze);
        node.methods.forEach(analyze);
        // Also analyze Java-style mainMethod and staticMethods
        const mainMethod = (node as any).mainMethod as IRFunction | undefined;
        const staticMethods = (node as any).staticMethods as IRFunction[] | undefined;
        if (mainMethod) analyze(mainMethod);
        if (staticMethods) staticMethods.forEach(analyze);
      }
      if (isIRIf(node)) {
        node.thenBranch.forEach(analyze);
        node.elseBranch?.forEach(analyze);
      }
      if (isIRFor(node) || isIRWhile(node)) {
        node.body.forEach(analyze);
      }
    };
    ir.body.forEach(analyze);
  }

  private getIndent(): string {
    return this.indentStr.repeat(this.indent);
  }

  private generateNode(node: IRNode): string {
    if (isIRComment(node)) return this.generateComment(node);
    if (isIRVariable(node)) return this.generateVariable(node);
    if (isIRFunction(node)) return this.generateFunction(node);
    if (isIRClass(node)) return this.generateClass(node);
    if (isIRIf(node)) return this.generateIf(node);
    if (isIRFor(node)) return this.generateFor(node);
    if (isIRWhile(node)) return this.generateWhile(node);
    if (isIRReturn(node)) return this.generateReturn(node);
    if (isIRPrint(node)) return this.generatePrint(node);
    if (isIRInput(node)) return this.generateInput(node);
    if (isIRAssignment(node)) return this.generateAssignment(node);
    if (isIRCall(node)) return `${this.getIndent()}${this.generateCall(node)};`;
    if (isIRBinaryOp(node)) return `${this.getIndent()}${this.generateBinaryOp(node)};`;
    
    return '';
  }

  private generateComment(node: IRComment): string {
    if (node.isMultiline) {
      return `${this.getIndent()}/*\n${this.getIndent()} * ${node.text}\n${this.getIndent()} */`;
    }
    return `${this.getIndent()}// ${node.text}`;
  }

  private generateVariable(node: IRVariable): string {
    const indent = this.getIndent();
    const type = this.mapType(node.dataType);
    
    if (node.value) {
      return `${indent}${type} ${node.name} = ${this.generateExpression(node.value)};`;
    }
    return `${indent}${type} ${node.name};`;
  }

  private generateFunction(node: IRFunction): string {
    const indent = this.getIndent();
    const returnType = this.mapType(node.returnType);
    const params = node.params.map(p => `${this.mapType(p.dataType, true)} ${p.name}`).join(', ');
    
    let code = `${indent}${returnType} ${node.name}(${params}) {\n`;
    
    this.indent++;
    for (const stmt of node.body) {
      const stmtCode = this.generateNode(stmt);
      if (stmtCode) code += stmtCode + '\n';
    }
    this.indent--;
    
    code += `${indent}}`;
    return code;
  }

  private generateClass(node: IRClass): string {
    const indent = this.getIndent();
    
    // Check if this is a Java-style class with only a static main method
    const mainMethod = (node as any).mainMethod as IRFunction | undefined;
    const staticMethods = (node as any).staticMethods as IRFunction[] | undefined;
    const hasOnlyMainMethod = mainMethod && node.methods.length === 0 && node.members.length === 0;
    
    // If it's a simple class wrapper around static main, just generate int main()
    if (hasOnlyMainMethod || (mainMethod && staticMethods)) {
      let code = '';
      
      // Generate static methods as regular C++ functions
      if (staticMethods) {
        for (const method of staticMethods) {
          const funcCode = this.generateFunction(method);
          code += funcCode + '\n\n';
        }
      }
      
      code += `${indent}int main() {\n`;
      this.indent++;
      for (const stmt of mainMethod!.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      code += `${this.getIndent()}return 0;\n`;
      this.indent--;
      code += `${indent}}`;
      return code;
    }
    
    let code = `${indent}class ${node.name} {\n`;
    
    // Private members
    code += `${indent}private:\n`;
    this.indent++;
    for (const member of node.members) {
      const type = this.mapType(member.dataType);
      code += `${this.getIndent()}${type} ${member.name};\n`;
    }
    this.indent--;
    
    // Public section
    code += `\n${indent}public:\n`;
    this.indent++;
    
    // Constructor
    const ctorParams = node.constructor?.params.map(p => `${this.mapType(p.dataType)} ${p.name}`).join(', ') || '';
    code += `${this.getIndent()}${node.name}(${ctorParams}) {\n`;
    this.indent++;
    
    for (const member of node.members) {
      code += `${this.getIndent()}this->${member.name} = ${this.getDefaultValue(member.dataType)};\n`;
    }
    
    if (node.constructor?.body) {
      for (const stmt of node.constructor.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
    }
    
    this.indent--;
    code += `${this.getIndent()}}\n`;
    
    // Methods
    for (const method of node.methods) {
      const returnType = this.mapType(method.returnType);
      const params = method.params.map(p => `${this.mapType(p.dataType)} ${p.name}`).join(', ');
      
      code += `\n${this.getIndent()}${returnType} ${method.name}(${params}) {\n`;
      this.indent++;
      for (const stmt of method.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent--;
      code += `${this.getIndent()}}\n`;
    }
    
    this.indent--;
    code += `${indent}};\n`;
    
    // If there's a main method, generate int main() with its body
    if (mainMethod) {
      code += `\n${indent}int main() {\n`;
      this.indent++;
      for (const stmt of mainMethod.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      code += `${this.getIndent()}return 0;\n`;
      this.indent--;
      code += `${indent}}`;
    }
    
    return code;
  }

  private generateIf(node: IRIf): string {
    const indent = this.getIndent();
    const condition = this.generateExpression(node.condition);
    
    let code = `${indent}if (${condition}) {\n`;
    
    this.indent++;
    for (const stmt of node.thenBranch) {
      const stmtCode = this.generateNode(stmt);
      if (stmtCode) code += stmtCode + '\n';
    }
    this.indent--;
    code += `${indent}}`;
    
    if (node.elseIf) {
      code += ` else ${this.generateIf(node.elseIf).trimStart()}`;
    } else if (node.elseBranch && node.elseBranch.length > 0) {
      code += ` else {\n`;
      this.indent++;
      for (const stmt of node.elseBranch) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent--;
      code += `${indent}}`;
    }
    
    return code;
  }

  private generateFor(node: IRFor): string {
    const indent = this.getIndent();
    
    // Handle Python range-style for loops
    if (node.iterator && node.rangeEnd) {
      const iterator = node.iterator;
      const start = node.rangeStart ? this.generateExpression(node.rangeStart) : '0';
      const end = this.generateExpression(node.rangeEnd);
      const step = node.rangeStep ? this.generateExpression(node.rangeStep) : '1';
      
      let code = `${indent}for (int ${iterator} = ${start}; ${iterator} < ${end}; ${iterator} += ${step}) {\n`;
      
      this.indent++;
      for (const stmt of node.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent--;
      code += `${indent}}`;
      
      return code;
    }
    
    let init = '';
    if (node.init) {
      if (isIRVariable(node.init)) {
        const type = this.mapType(node.init.dataType);
        const value = node.init.value ? this.generateExpression(node.init.value) : '0';
        init = `${type} ${node.init.name} = ${value}`;
      } else {
        init = this.generateExpression(node.init);
      }
    }
    
    const condition = node.condition ? this.generateExpression(node.condition) : '';
    const update = node.update ? this.generateExpression(node.update) : '';
    
    let code = `${indent}for (${init}; ${condition}; ${update}) {\n`;
    
    this.indent++;
    for (const stmt of node.body) {
      const stmtCode = this.generateNode(stmt);
      if (stmtCode) code += stmtCode + '\n';
    }
    this.indent--;
    code += `${indent}}`;
    
    return code;
  }

  private generateWhile(node: IRWhile): string {
    const indent = this.getIndent();
    const condition = this.generateExpression(node.condition);
    
    let code = `${indent}while (${condition}) {\n`;
    
    this.indent++;
    for (const stmt of node.body) {
      const stmtCode = this.generateNode(stmt);
      if (stmtCode) code += stmtCode + '\n';
    }
    this.indent--;
    code += `${indent}}`;
    
    return code;
  }

  private generateReturn(node: IRReturn): string {
    const indent = this.getIndent();
    if (node.value) {
      return `${indent}return ${this.generateExpression(node.value)};`;
    }
    return `${indent}return;`;
  }

  private generatePrint(node: IRPrint): string {
    const indent = this.getIndent();
    
    if (node.args.length === 0) {
      return node.newline ? `${indent}cout << endl;` : '';
    }
    
    let code = `${indent}cout`;
    
    for (const arg of node.args) {
      if (isIRLiteral(arg) && arg.dataType === 'string') {
        // Parse f-string interpolation
        const parts = this.parseFString(String(arg.value));
        for (const part of parts) {
          if (part.isVar) {
            code += ` << ${part.value}`;
          } else if (part.value) {
            code += ` << "${part.value}"`;
          }
        }
      } else {
        code += ` << ${this.generateExpression(arg)}`;
      }
    }
    
    if (node.newline) {
      code += ' << endl';
    }
    
    code += ';';
    return code;
  }
  
  private parseFString(str: string): { value: string; isVar: boolean }[] {
    const parts: { value: string; isVar: boolean }[] = [];
    const regex = /\{([^}]+)\}/g;
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ value: str.slice(lastIndex, match.index), isVar: false });
      }
      parts.push({ value: match[1], isVar: true });
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < str.length) {
      parts.push({ value: str.slice(lastIndex), isVar: false });
    }
    
    return parts;
  }

  private generateInput(node: IRInput): string {
    const indent = this.getIndent();
    
    let code = '';
    if (node.prompt) {
      code += `${indent}cout << "${node.prompt}";\n`;
    }
    
    if (node.targetVar) {
      code += `${indent}cin >> ${node.targetVar};`;
    }
    
    return code;
  }

  private generateAssignment(node: IRAssignment): string {
    const indent = this.getIndent();
    const target = node.target.replace('self.', 'this->');
    return `${indent}${target} = ${this.generateExpression(node.value)};`;
  }

  private generateExpression(node: IRNode): string {
    if (isIRLiteral(node)) return this.generateLiteral(node);
    if (isIRIdentifier(node)) return this.generateIdentifier(node);
    if (isIRBinaryOp(node)) return this.generateBinaryOp(node);
    if (isIRCall(node)) return this.generateCall(node);
    if (node.type === 'unary_op') {
      const unary = node as IRUnaryOp;
      const operand = this.generateExpression(unary.operand);
      if (unary.operator === '++_post') return `${operand}++`;
      if (unary.operator === '--_post') return `${operand}--`;
      return `${unary.operator}${operand}`;
    }
    return '';
  }

  private generateLiteral(node: IRLiteral): string {
    if (node.dataType === 'string') {
      return `"${node.value}"`;
    }
    if (node.dataType === 'char') {
      return `'${node.value}'`;
    }
    if (node.dataType === 'bool') {
      return node.value ? 'true' : 'false';
    }
    if (node.value === 'null') return 'nullptr';
    return String(node.value);
  }

  private generateIdentifier(node: IRIdentifier): string {
    if (node.name === 'this' || node.name === 'self') return 'this';
    if (node.name.startsWith('self.')) return node.name.replace('self.', 'this->');
    return node.name;
  }

  private generateBinaryOp(node: IRBinaryOp): string {
    const left = this.generateExpression(node.left);
    const right = this.generateExpression(node.right);
    return `${left} ${node.operator} ${right}`;
  }

  private generateCall(node: IRCall): string {
    const args = node.args.map(arg => this.generateExpression(arg)).join(', ');
    
    // Type conversion
    if (node.callee === 'int') return `static_cast<int>(${args})`;
    if (node.callee === 'float') return `static_cast<float>(${args})`;
    if (node.callee === 'str') return `to_string(${args})`;
    
    if (node.isMethod && node.object) {
      const obj = node.object === 'self' ? 'this' : node.object;
      return `${obj}->${node.callee}(${args})`;
    }
    
    return `${node.callee}(${args})`;
  }

  private mapType(type: DataType, isParam = false): string {
    const typeMap: Record<string, string> = {
      'int': 'int',
      'float': 'float',
      'double': 'double',
      'char': 'char',
      'string': 'string',
      'bool': 'bool',
      'void': 'void',
      'auto': isParam ? 'string' : 'auto', // Use string for params, auto for vars
    };
    return typeMap[type] || 'auto';
  }

  private getDefaultValue(type: DataType): string {
    switch (type) {
      case 'int': return '0';
      case 'float':
      case 'double': return '0.0';
      case 'string': return '""';
      case 'bool': return 'false';
      case 'char': return "'\\0'";
      default: return '0';
    }
  }
}
