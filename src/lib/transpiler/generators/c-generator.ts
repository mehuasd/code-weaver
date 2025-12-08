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

export class CGenerator {
  private indent = 0;
  private indentStr = '    ';
  private usesStdio = false;
  private usesString = false;
  private usesBool = false;

  generate(ir: IRProgram): string {
    this.indent = 0;
    this.usesStdio = false;
    this.usesString = false;
    this.usesBool = false;
    
    // First pass to detect what we need
    this.analyzeProgram(ir);
    
    const lines: string[] = [];
    
    // Includes
    if (this.usesStdio) lines.push('#include <stdio.h>');
    if (this.usesString) lines.push('#include <string.h>');
    if (this.usesBool) lines.push('#include <stdbool.h>');
    if (lines.length > 0) lines.push('');
    
    // Separate functions/classes from main content
    const functions = ir.body.filter(n => isIRFunction(n));
    const classes = ir.body.filter(n => isIRClass(n));
    const mainContent = ir.body.filter(n => !isIRFunction(n) && !isIRClass(n));
    
    // Generate classes first (structs in C)
    for (const node of classes) {
      const code = this.generateNode(node);
      if (code) lines.push(code);
    }
    
    // Generate functions (but wrap 'main' in int main)
    for (const func of functions) {
      const f = func as IRFunction;
      if (f.name === 'main') {
        // Generate as int main()
        lines.push('int main() {');
        this.indent++;
        for (const stmt of f.body) {
          const code = this.generateNode(stmt);
          if (code) lines.push(code);
        }
        lines.push(`${this.getIndent()}return 0;`);
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
      if (isIRPrint(node) || isIRInput(node)) this.usesStdio = true;
      if (isIRVariable(node) && node.dataType === 'string') this.usesString = true;
      if (isIRVariable(node) && node.dataType === 'bool') this.usesBool = true;
      if (isIRFunction(node)) {
        node.body.forEach(analyze);
        node.params.forEach(p => { if (p.dataType === 'bool') this.usesBool = true; });
      }
      if (isIRClass(node)) {
        node.members.forEach(analyze);
        node.methods.forEach(analyze);
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
    
    if (node.dataType === 'string') {
      const value = node.value ? this.generateExpression(node.value) : '""';
      return `${indent}char ${node.name}[256] = ${value};`;
    }
    
    if (node.value) {
      return `${indent}${type} ${node.name} = ${this.generateExpression(node.value)};`;
    }
    return `${indent}${type} ${node.name};`;
  }

  private generateFunction(node: IRFunction): string {
    const indent = this.getIndent();
    const returnType = this.mapType(node.returnType);
    const params = node.params.map(p => {
      const type = this.mapType(p.dataType, true);
      if (p.dataType === 'string') return `char ${p.name}[]`;
      return `${type} ${p.name}`;
    }).join(', ');
    
    let code = `${indent}${returnType} ${node.name}(${params || 'void'}) {\n`;
    
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
    // C doesn't have classes, convert to struct with function pointers
    const indent = this.getIndent();
    
    // Check if this is a Java-style class with only a static main method
    const mainMethod = (node as any).mainMethod as IRFunction | undefined;
    const hasOnlyMainMethod = mainMethod && node.methods.length === 0 && node.members.length === 0;
    
    // If it's a simple class wrapper around static main, just generate int main()
    if (hasOnlyMainMethod) {
      let code = `${indent}int main() {\n`;
      this.indent++;
      for (const stmt of mainMethod.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      code += `${this.getIndent()}return 0;\n`;
      this.indent--;
      code += `${indent}}`;
      return code;
    }
    
    let code = '';
    
    // Forward declaration
    code += `${indent}typedef struct ${node.name} ${node.name};\n\n`;
    
    // Struct definition
    code += `${indent}struct ${node.name} {\n`;
    this.indent++;
    
    for (const member of node.members) {
      const type = this.mapType(member.dataType);
      if (member.dataType === 'string') {
        code += `${this.getIndent()}char ${member.name}[256];\n`;
      } else {
        code += `${this.getIndent()}${type} ${member.name};\n`;
      }
    }
    
    // Method pointers
    for (const method of node.methods) {
      const returnType = this.mapType(method.returnType);
      const params = method.params.map(p => this.mapType(p.dataType)).join(', ');
      code += `${this.getIndent()}${returnType} (*${method.name})(${node.name}*${params ? ', ' + params : ''});\n`;
    }
    
    this.indent--;
    code += `${indent}};\n\n`;
    
    // Method implementations
    for (const method of node.methods) {
      const returnType = this.mapType(method.returnType);
      const params = method.params.map(p => `${this.mapType(p.dataType)} ${p.name}`).join(', ');
      
      code += `${indent}${returnType} ${node.name}_${method.name}(${node.name}* self${params ? ', ' + params : ''}) {\n`;
      this.indent++;
      for (const stmt of method.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent--;
      code += `${indent}}\n\n`;
    }
    
    // Constructor/initializer
    code += `${indent}void ${node.name}_init(${node.name}* self`;
    if (node.constructor?.params.length) {
      const params = node.constructor.params.map(p => `${this.mapType(p.dataType)} ${p.name}`).join(', ');
      code += `, ${params}`;
    }
    code += `) {\n`;
    this.indent++;
    
    for (const member of node.members) {
      code += `${this.getIndent()}self->${member.name} = ${this.getDefaultValue(member.dataType)};\n`;
    }
    for (const method of node.methods) {
      code += `${this.getIndent()}self->${method.name} = ${node.name}_${method.name};\n`;
    }
    
    this.indent--;
    code += `${indent}}\n`;
    
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
    
    // Classic C for loop
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
      return node.newline ? `${indent}printf("\\n");` : '';
    }
    
    // Build format string and args
    let format = '';
    const args: string[] = [];
    
    for (const arg of node.args) {
      if (isIRLiteral(arg) && arg.dataType === 'string') {
        // String literal - check for f-string interpolation
        const strValue = String(arg.value);
        // Parse f-string interpolation like {name} or {var}
        const parsed = this.parseFStringToFormat(strValue);
        format += parsed.format;
        args.push(...parsed.args);
      } else {
        // Variable or expression
        const expr = this.generateExpression(arg);
        const type = this.inferType(arg);
        
        switch (type) {
          case 'int':
            format += '%d';
            break;
          case 'float':
          case 'double':
            format += '%f';
            break;
          case 'char':
            format += '%c';
            break;
          default:
            format += '%s';
        }
        args.push(expr);
      }
    }
    
    if (node.newline && !format.endsWith('\\n')) {
      format += '\\n';
    }
    
    if (args.length === 0) {
      return `${indent}printf("${format}");`;
    }
    return `${indent}printf("${format}", ${args.join(', ')});`;
  }
  
  private parseFStringToFormat(str: string): { format: string; args: string[] } {
    const args: string[] = [];
    const format = str.replace(/\{([^}]+)\}/g, (_, varName) => {
      args.push(varName);
      return '%s';
    });
    return { format, args };
  }

  private generateInput(node: IRInput): string {
    const indent = this.getIndent();
    
    if (node.prompt) {
      const printLine = `${indent}printf("${node.prompt}");\n`;
      if (node.targetVar) {
        const format = node.targetType === 'int' ? '%d' : 
                      node.targetType === 'float' ? '%f' : '%s';
        return printLine + `${indent}scanf("${format}", &${node.targetVar});`;
      }
      return printLine;
    }
    
    if (node.targetVar) {
      const format = node.targetType === 'int' ? '%d' : 
                    node.targetType === 'float' ? '%f' : '%s';
      return `${indent}scanf("${format}", &${node.targetVar});`;
    }
    
    return '';
  }

  private generateAssignment(node: IRAssignment): string {
    const indent = this.getIndent();
    const target = node.target.replace('self.', 'self->');
    return `${indent}${target} = ${this.generateExpression(node.value)};`;
  }

  private generateExpression(node: IRNode): string {
    if (isIRLiteral(node)) return this.generateLiteral(node);
    if (isIRIdentifier(node)) return this.generateIdentifier(node);
    if (isIRBinaryOp(node)) return this.generateBinaryOp(node);
    if (isIRCall(node)) return this.generateCall(node);
    if (isIRInput(node)) {
      // Input as expression - needs special handling
      return '0'; // Placeholder
    }
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
    if (node.value === 'null') return 'NULL';
    return String(node.value);
  }

  private generateIdentifier(node: IRIdentifier): string {
    if (node.name === 'this') return 'self';
    if (node.name.startsWith('self.')) return node.name.replace('self.', 'self->');
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
    if (node.callee === 'int') return `(int)(${args})`;
    if (node.callee === 'float') return `(float)(${args})`;
    if (node.callee === 'str') return args; // Need proper handling
    
    if (node.isMethod && node.object) {
      const obj = node.object === 'this' ? 'self' : node.object;
      return `${obj}->${node.callee}(${obj}${args ? ', ' + args : ''})`;
    }
    
    return `${node.callee}(${args})`;
  }

  private mapType(type: DataType, isParam = false): string {
    const typeMap: Record<string, string> = {
      'int': 'int',
      'float': 'float',
      'double': 'double',
      'char': 'char',
      'string': 'char*',
      'bool': 'bool',
      'void': 'void',
      'auto': isParam ? 'const char*' : 'int', // Assume string params by default
    };
    return typeMap[type] || 'int';
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

  private inferType(node: IRNode): DataType {
    if (isIRLiteral(node)) return node.dataType;
    if (isIRIdentifier(node)) return 'auto';
    if (isIRCall(node)) {
      if (node.callee === 'int') return 'int';
      if (node.callee === 'float') return 'float';
      if (node.callee === 'str') return 'string';
    }
    return 'auto';
  }
}
