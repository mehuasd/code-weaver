import {
  IRNode,
  IRProgram,
  IRVariable,
  IRFunction,
  IRClass,
  IRIf,
  IRFor,
  IRWhile,
  IRSwitch,
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
  isIRSwitch,
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

export class JavaGenerator {
  private indent = 0;
  private indentStr = '    ';
  private usesScanner = false;
  private className = 'Main';
  private isInsideVoidMain = false;

  generate(ir: IRProgram, className = 'Main'): string {
    this.indent = 0;
    this.usesScanner = false;
    this.className = className;
    this.isInsideVoidMain = false;
    
    this.analyzeProgram(ir);
    
    const lines: string[] = [];
    
    // Imports
    if (this.usesScanner) {
      lines.push('import java.util.Scanner;');
      lines.push('');
    }
    
    // Check if there's a class definition
    const hasClass = ir.body.some(n => isIRClass(n));
    
    if (hasClass) {
      // Generate classes directly
      for (const node of ir.body) {
        const code = this.generateNode(node);
        if (code) lines.push(code);
      }
    } else {
      // Wrap in Main class
      lines.push(`public class ${this.className} {`);
      this.indent++;
      
      // Scanner if needed
      if (this.usesScanner) {
        lines.push(`${this.getIndent()}static Scanner scanner = new Scanner(System.in);`);
        lines.push('');
      }
      
      // Generate functions and main content
      const functions = ir.body.filter(n => isIRFunction(n));
      const mainContent = ir.body.filter(n => !isIRFunction(n));
      
      // Generate functions
      for (const func of functions) {
        const funcNode = func as IRFunction;
        if (funcNode.name === 'main') {
          // Generate main method
          this.isInsideVoidMain = true;
          lines.push(`${this.getIndent()}public static void main(String[] args) {`);
          this.indent++;
          for (const stmt of funcNode.body) {
            // Skip return 0 in void main
            if (this.shouldSkipReturnInMain(stmt)) continue;
            const code = this.generateNode(stmt);
            if (code) lines.push(code);
          }
          this.indent--;
          lines.push(`${this.getIndent()}}`);
          this.isInsideVoidMain = false;
        } else {
          const code = this.generateFunction(funcNode, true);
          if (code) lines.push(code);
        }
      }
      
      // If no main function, generate one with remaining content
      if (!functions.some(f => (f as IRFunction).name === 'main') && mainContent.length > 0) {
        this.isInsideVoidMain = true;
        lines.push(`${this.getIndent()}public static void main(String[] args) {`);
        this.indent++;
        for (const node of mainContent) {
          // Skip return 0 in void main
          if (this.shouldSkipReturnInMain(node)) continue;
          const code = this.generateNode(node);
          if (code) lines.push(code);
        }
        this.indent--;
        lines.push(`${this.getIndent()}}`);
        this.isInsideVoidMain = false;
      }
      
      this.indent--;
      lines.push('}');
    }
    
    return lines.join('\n');
  }
  
  private shouldSkipReturnInMain(node: IRNode): boolean {
    if (!this.isInsideVoidMain) return false;
    if (node.type === 'return') {
      const ret = node as IRReturn;
      // Skip return 0 or return with int value
      if (ret.value && isIRLiteral(ret.value) && typeof ret.value.value === 'number') {
        return true;
      }
    }
    return false;
  }

  private analyzeProgram(ir: IRProgram): void {
    const analyze = (node: IRNode) => {
      if (isIRInput(node)) this.usesScanner = true;
      if (isIRFunction(node)) node.body.forEach(analyze);
      if (isIRClass(node)) {
        node.methods.forEach(analyze);
        if (node.constructor) node.constructor.body.forEach(analyze);
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
    if (isIRSwitch(node)) return this.generateSwitch(node);
    if (isIRReturn(node)) return this.generateReturn(node);
    if (isIRPrint(node)) return this.generatePrint(node);
    if (isIRInput(node)) return this.generateInput(node);
    if (isIRAssignment(node)) return this.generateAssignment(node);
    if (isIRCall(node)) return `${this.getIndent()}${this.generateCall(node)};`;
    if (isIRBinaryOp(node)) return `${this.getIndent()}${this.generateBinaryOp(node)};`;
    if (node.type === 'break') return `${this.getIndent()}break;`;
    
    return '';
  }
  
  private generateSwitch(node: IRSwitch): string {
    const indent = this.getIndent();
    const expr = this.generateExpression(node.expression);
    let code = `${indent}switch (${expr}) {\n`;
    
    for (const c of node.cases) {
      code += `${indent}    case ${this.generateExpression(c.value)}:\n`;
      this.indent += 2;
      for (const stmt of c.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      code += `${this.getIndent()}break;\n`;
      this.indent -= 2;
    }
    
    if (node.defaultBody) {
      code += `${indent}    default:\n`;
      this.indent += 2;
      for (const stmt of node.defaultBody) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent -= 2;
    }
    
    code += `${indent}}`;
    return code;
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
    
    // Special case: variable initialized from input
    if (node.value && isIRInput(node.value)) {
      const input = node.value as IRInput;
      let code = '';
      
      if (input.prompt) {
        code += `${indent}System.out.print("${input.prompt}");\n`;
      }
      
      const method = node.dataType === 'int' ? 'nextInt()' :
                    node.dataType === 'float' ? 'nextFloat()' : 'nextLine()';
      code += `${indent}${type} ${node.name} = scanner.${method};`;
      return code;
    }
    
    if (node.value) {
      return `${indent}${type} ${node.name} = ${this.generateExpression(node.value)};`;
    }
    return `${indent}${type} ${node.name};`;
  }

  private generateFunction(node: IRFunction, isStatic = false): string {
    const indent = this.getIndent();
    const returnType = this.mapType(node.returnType, false, true);
    const params = node.params.map(p => `${this.mapType(p.dataType, true)} ${p.name}`).join(', ');
    const staticMod = isStatic ? 'static ' : '';
    
    let code = `${indent}public ${staticMod}${returnType} ${node.name}(${params}) {\n`;
    
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
    let code = `${indent}public class ${node.name} {\n`;
    
    this.indent++;
    
    // Scanner if needed
    if (this.usesScanner) {
      code += `${this.getIndent()}static Scanner scanner = new Scanner(System.in);\n\n`;
    }
    
    // Members
    for (const member of node.members) {
      const type = this.mapType(member.dataType);
      code += `${this.getIndent()}private ${type} ${member.name};\n`;
    }
    
    if (node.members.length > 0) code += '\n';
    
    // Constructor
    const ctorParams = node.constructor?.params.map(p => `${this.mapType(p.dataType)} ${p.name}`).join(', ') || '';
    code += `${this.getIndent()}public ${node.name}(${ctorParams}) {\n`;
    this.indent++;
    
    for (const member of node.members) {
      code += `${this.getIndent()}this.${member.name} = ${this.getDefaultValue(member.dataType)};\n`;
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
      
      code += `\n${this.getIndent()}public ${returnType} ${method.name}(${params}) {\n`;
      this.indent++;
      for (const stmt of method.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent--;
      code += `${this.getIndent()}}\n`;
    }
    
    this.indent--;
    code += `${indent}}`;
    
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
    
    // Skip return with numeric value in void main
    if (this.isInsideVoidMain && node.value && isIRLiteral(node.value) && typeof node.value.value === 'number') {
      return '';
    }
    
    if (node.value) {
      return `${indent}return ${this.generateExpression(node.value)};`;
    }
    return `${indent}return;`;
  }

  private generatePrint(node: IRPrint): string {
    const indent = this.getIndent();
    const method = node.newline ? 'println' : 'print';
    
    if (node.args.length === 0) {
      return `${indent}System.out.${method}();`;
    }
    
    // Build concatenated string with f-string support
    const parts: string[] = [];
    for (const arg of node.args) {
      if (isIRLiteral(arg) && arg.dataType === 'string') {
        // Parse f-string interpolation
        const parsed = this.parseFString(String(arg.value));
        parts.push(parsed);
      } else {
        parts.push(this.generateExpression(arg));
      }
    }
    const output = parts.join(' + " " + ');
    
    return `${indent}System.out.${method}(${output});`;
  }
  
  private parseFString(str: string): string {
    // Clean up trailing newline
    const cleaned = str.replace(/\\n$/, '');
    
    // Convert {var} to " + var + "
    const result = cleaned.replace(/\{([^}]+)\}/g, '" + $1 + "');
    return `"${result}"`.replace(/"" \+ /g, '').replace(/ \+ ""/g, '');
  }

  private generateInput(node: IRInput): string {
    const indent = this.getIndent();
    
    let code = '';
    if (node.prompt) {
      code += `${indent}System.out.print("${node.prompt}");\n`;
    }
    
    if (node.targetVar) {
      const method = node.targetType === 'int' ? 'nextInt()' :
                    node.targetType === 'float' ? 'nextFloat()' : 'nextLine()';
      code += `${indent}${node.targetVar} = scanner.${method};`;
    }
    
    return code;
  }

  private generateAssignment(node: IRAssignment): string {
    const indent = this.getIndent();
    const target = node.target.replace('self.', 'this.');
    return `${indent}${target} = ${this.generateExpression(node.value)};`;
  }

  private generateExpression(node: IRNode): string {
    if (isIRLiteral(node)) return this.generateLiteral(node);
    if (isIRIdentifier(node)) return this.generateIdentifier(node);
    if (isIRBinaryOp(node)) return this.generateBinaryOp(node);
    if (isIRCall(node)) return this.generateCall(node);
    if (isIRInput(node)) {
      const method = node.targetType === 'int' ? 'nextInt()' :
                    node.targetType === 'float' ? 'nextFloat()' : 'nextLine()';
      return `scanner.${method}`;
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
    if (node.value === 'null') return 'null';
    if (node.dataType === 'float') return `${node.value}f`;
    return String(node.value);
  }

  private generateIdentifier(node: IRIdentifier): string {
    if (node.name === 'self') return 'this';
    if (node.name.startsWith('self.')) return node.name.replace('self.', 'this.');
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
    if (node.callee === 'int') return `Integer.parseInt(${args})`;
    if (node.callee === 'float') return `Float.parseFloat(${args})`;
    if (node.callee === 'str') return `String.valueOf(${args})`;
    
    if (node.isMethod && node.object) {
      const obj = node.object === 'self' ? 'this' : node.object;
      return `${obj}.${node.callee}(${args})`;
    }
    
    // Constructor call (new ClassName)
    if (node.callee[0] === node.callee[0].toUpperCase() && !node.isMethod) {
      return `new ${node.callee}(${args})`;
    }
    
    return `${node.callee}(${args})`;
  }

  private mapType(type: DataType, isParam = false, isReturnType = false): string {
    const typeMap: Record<string, string> = {
      'int': 'int',
      'float': 'float',
      'double': 'double',
      'char': 'char',
      'string': 'String',
      'bool': 'boolean',
      'void': 'void',
      'auto': isReturnType ? 'void' : (isParam ? 'String' : 'Object'), // No var for params or returns
    };
    return typeMap[type] || 'Object';
  }

  private getDefaultValue(type: DataType): string {
    switch (type) {
      case 'int': return '0';
      case 'float':
      case 'double': return '0.0';
      case 'string': return '""';
      case 'bool': return 'false';
      case 'char': return "' '";
      default: return 'null';
    }
  }
}
