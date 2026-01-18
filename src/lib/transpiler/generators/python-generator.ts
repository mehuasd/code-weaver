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
  isIRProgram,
  isIRVariable,
  isIRFunction,
  isIRClass,
  isIRPrint,
  isIRLiteral,
  isIRIdentifier,
  isIRBinaryOp,
  isIRFor,
  isIRIf,
  isIRCall,
  isIRReturn,
  isIRAssignment,
  isIRComment,
  isIRWhile,
  isIRInput,
  isIRSwitch,
} from '../ir';

export class PythonGenerator {
  private indent = 0;
  private indentStr = '    ';

  generate(ir: IRProgram): string {
    this.indent = 0;
    const lines: string[] = [];
    
    for (const node of ir.body) {
      const code = this.generateNode(node);
      if (code) lines.push(code);
    }
    
    return lines.join('\n');
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
    if (isIRCall(node)) return this.getIndent() + this.generateCall(node);
    if (isIRBinaryOp(node)) return this.getIndent() + this.generateBinaryOp(node);
    if (isIRLiteral(node)) return this.getIndent() + this.generateLiteral(node);
    if (isIRIdentifier(node)) return this.getIndent() + this.generateIdentifier(node);
    if (node.type === 'break') return `${this.getIndent()}break`;
    
    return '';
  }

  private generateComment(node: IRComment): string {
    if (node.isMultiline) {
      return `${this.getIndent()}"""\n${this.getIndent()}${node.text}\n${this.getIndent()}"""`;
    }
    return `${this.getIndent()}# ${node.text}`;
  }

  private generateVariable(node: IRVariable): string {
    const indent = this.getIndent();
    
    // Special case: variable initialized from input
    if (node.value && isIRInput(node.value)) {
      const input = node.value as IRInput;
      const prompt = input.prompt ? `"${input.prompt}"` : '';
      
      if (node.dataType === 'int') {
        return `${indent}${node.name} = int(input(${prompt}))`;
      } else if (node.dataType === 'float') {
        return `${indent}${node.name} = float(input(${prompt}))`;
      } else {
        return `${indent}${node.name} = input(${prompt})`;
      }
    }
    
    const value = node.value ? this.generateExpression(node.value) : this.getDefaultValue(node.dataType);
    return `${indent}${node.name} = ${value}`;
  }

  private generateFunction(node: IRFunction): string {
    const indent = this.getIndent();
    const params = node.params.map(p => p.name).join(', ');
    
    let code = `${indent}def ${node.name}(${params}):\n`;
    
    this.indent++;
    if (node.body.length === 0) {
      code += `${this.getIndent()}pass\n`;
    } else {
      for (const stmt of node.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
    }
    this.indent--;
    
    return code;
  }

  private generateClass(node: IRClass): string {
    const indent = this.getIndent();
    
    // Check if this is a Java-style class with only a static main method
    const mainMethod = (node as any).mainMethod as IRFunction | undefined;
    const staticMethods = (node as any).staticMethods as IRFunction[] | undefined;
    const hasOnlyMainMethod = mainMethod && node.methods.length === 0 && node.members.length === 0;
    
    // If it's a simple class wrapper around static main, extract the code as global
    if (hasOnlyMainMethod || (mainMethod && staticMethods)) {
      let code = '';
      
      // Generate static methods as regular Python functions
      if (staticMethods) {
        for (const method of staticMethods) {
          const funcCode = this.generateFunction(method);
          code += funcCode + '\n';
        }
      }
      
      code += '# Main program\n';
      for (const stmt of mainMethod!.body) {
        // Skip return 0 in main
        if (stmt.type === 'return') {
          const ret = stmt as IRReturn;
          if (ret.value && isIRLiteral(ret.value) && ret.value.value === 0) {
            continue;
          }
        }
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      return code.trimEnd();
    }
    
    let code = `${indent}class ${node.name}:\n`;
    
    this.indent++;
    
    // Constructor
    if (node.constructor || node.members.length > 0) {
      const params = node.constructor?.params.map(p => p.name).join(', ') || '';
      code += `${this.getIndent()}def __init__(self${params ? ', ' + params : ''}):\n`;
      
      this.indent++;
      if (node.members.length > 0) {
        for (const member of node.members) {
          const value = member.value ? this.generateExpression(member.value) : this.getDefaultValue(member.dataType);
          code += `${this.getIndent()}self.${member.name} = ${value}\n`;
        }
      }
      if (node.constructor?.body) {
        for (const stmt of node.constructor.body) {
          const stmtCode = this.generateNode(stmt);
          if (stmtCode && !stmtCode.includes('self.')) {
            code += stmtCode + '\n';
          }
        }
      }
      if (node.members.length === 0 && (!node.constructor?.body || node.constructor.body.length === 0)) {
        code += `${this.getIndent()}pass\n`;
      }
      this.indent--;
    }
    
    // Methods
    for (const method of node.methods) {
      const params = method.params.map(p => p.name).join(', ');
      code += `\n${this.getIndent()}def ${method.name}(self${params ? ', ' + params : ''}):\n`;
      
      this.indent++;
      if (method.body.length === 0) {
        code += `${this.getIndent()}pass\n`;
      } else {
        for (const stmt of method.body) {
          const stmtCode = this.generateNode(stmt);
          if (stmtCode) code += stmtCode + '\n';
        }
      }
      this.indent--;
    }
    
    this.indent--;
    return code;
  }

  private generateIf(node: IRIf): string {
    const indent = this.getIndent();
    const condition = this.generateExpression(node.condition);
    
    let code = `${indent}if ${condition}:\n`;
    
    this.indent++;
    for (const stmt of node.thenBranch) {
      const stmtCode = this.generateNode(stmt);
      if (stmtCode) code += stmtCode + '\n';
    }
    if (node.thenBranch.length === 0) {
      code += `${this.getIndent()}pass\n`;
    }
    this.indent--;
    
    if (node.elseIf) {
      code += `${indent}el${this.generateIf(node.elseIf).trimStart()}`;
    } else if (node.elseBranch && node.elseBranch.length > 0) {
      code += `${indent}else:\n`;
      this.indent++;
      for (const stmt of node.elseBranch) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent--;
    }
    
    return code.trimEnd();
  }

  private generateFor(node: IRFor): string {
    const indent = this.getIndent();
    const iterator = node.iterator || 'i';
    
    // Python-style range loop
    if (node.rangeEnd) {
      let rangeArgs: string;
      const start = node.rangeStart ? this.generateExpression(node.rangeStart) : '0';
      const end = this.generateExpression(node.rangeEnd);
      const step = node.rangeStep ? this.generateExpression(node.rangeStep) : '1';
      
      if (start === '0' && step === '1') {
        rangeArgs = end;
      } else if (step === '1') {
        rangeArgs = `${start}, ${end}`;
      } else {
        rangeArgs = `${start}, ${end}, ${step}`;
      }
      
      let code = `${indent}for ${iterator} in range(${rangeArgs}):\n`;
      
      this.indent++;
      for (const stmt of node.body) {
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      if (node.body.length === 0) {
        code += `${this.getIndent()}pass\n`;
      }
      this.indent--;
      
      return code.trimEnd();
    }
    
    // While-style for loop fallback
    let code = '';
    if (node.init) {
      code += this.generateNode(node.init) + '\n';
    }
    
    const condition = node.condition ? this.generateExpression(node.condition) : 'True';
    code += `${indent}while ${condition}:\n`;
    
    this.indent++;
    for (const stmt of node.body) {
      const stmtCode = this.generateNode(stmt);
      if (stmtCode) code += stmtCode + '\n';
    }
    if (node.update) {
      code += this.generateNode(node.update) + '\n';
    }
    this.indent--;
    
    return code.trimEnd();
  }

  private generateWhile(node: IRWhile): string {
    const indent = this.getIndent();
    const condition = this.generateExpression(node.condition);
    
    let code = `${indent}while ${condition}:\n`;
    
    this.indent++;
    for (const stmt of node.body) {
      const stmtCode = this.generateNode(stmt);
      if (stmtCode) code += stmtCode + '\n';
    }
    if (node.body.length === 0) {
      code += `${this.getIndent()}pass\n`;
    }
    this.indent--;
    
    return code.trimEnd();
  }

  private generateSwitch(node: IRSwitch): string {
    // Python 3.10+ has match-case, but we'll convert to if-elif for broader compatibility
    const indent = this.getIndent();
    const expr = this.generateExpression(node.expression);
    let code = '';
    
    for (let i = 0; i < node.cases.length; i++) {
      const c = node.cases[i];
      const keyword = i === 0 ? 'if' : 'elif';
      code += `${indent}${keyword} ${expr} == ${this.generateExpression(c.value)}:\n`;
      this.indent++;
      for (const stmt of c.body) {
        if (stmt.type === 'break') continue; // Skip break in Python
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      if (c.body.filter(s => s.type !== 'break').length === 0) {
        code += `${this.getIndent()}pass\n`;
      }
      this.indent--;
    }
    
    if (node.defaultBody && node.defaultBody.length > 0) {
      code += `${indent}else:\n`;
      this.indent++;
      for (const stmt of node.defaultBody) {
        if (stmt.type === 'break') continue;
        const stmtCode = this.generateNode(stmt);
        if (stmtCode) code += stmtCode + '\n';
      }
      this.indent--;
    }
    
    return code.trimEnd();
  }

  private generateReturn(node: IRReturn): string {
    const indent = this.getIndent();
    if (node.value) {
      return `${indent}return ${this.generateExpression(node.value)}`;
    }
    return `${indent}return`;
  }

  private generatePrint(node: IRPrint): string {
    const indent = this.getIndent();
    
    // Convert C-style format strings to Python
    const convertedArgs = node.args.map(arg => {
      if (isIRLiteral(arg) && arg.dataType === 'string') {
        const strValue = String(arg.value);
        // Check for C format specifiers
        if (/%[dsifc]/.test(strValue)) {
          // Return string without format specifiers for now
          // The variables should be in subsequent args
          return null; // Will be handled below
        }
        // Check for f-string interpolation
        if (strValue.includes('{') && strValue.includes('}')) {
          return `f"${strValue}"`;
        }
        return this.generateExpression(arg);
      }
      return this.generateExpression(arg);
    }).filter(Boolean);
    
    // If first arg has C format specifiers, convert to f-string
    if (node.args.length > 0 && isIRLiteral(node.args[0]) && node.args[0].dataType === 'string') {
      const formatStr = String(node.args[0].value);
      if (/%[dsifc]/.test(formatStr)) {
        // Get the variable arguments
        const varArgs = node.args.slice(1).map(a => this.generateExpression(a));
        let argIndex = 0;
        const converted = formatStr
          .replace(/\\n$/, '')
          .replace(/%[dsifc]/g, () => {
            const varName = varArgs[argIndex++] || '';
            return `{${varName}}`;
          });
        
        if (!node.newline) {
          return `${indent}print(f"${converted}", end='')`;
        }
        return `${indent}print(f"${converted}")`;
      }
    }
    
    const args = convertedArgs.join(', ');
    
    if (!node.newline) {
      return `${indent}print(${args}, end='')`;
    }
    return `${indent}print(${args})`;
  }

  private generateInput(node: IRInput): string {
    const indent = this.getIndent();
    const prompt = node.prompt ? `"${node.prompt}"` : '""';
    
    if (node.targetVar) {
      if (node.targetType === 'int') {
        return `${indent}${node.targetVar} = int(input(${prompt}))`;
      } else if (node.targetType === 'float') {
        return `${indent}${node.targetVar} = float(input(${prompt}))`;
      }
      return `${indent}${node.targetVar} = input(${prompt})`;
    }
    
    return `${indent}input(${prompt})`;
  }

  private generateAssignment(node: IRAssignment): string {
    const indent = this.getIndent();
    const value = this.generateExpression(node.value);
    return `${indent}${node.target} = ${value}`;
  }

  private generateExpression(node: IRNode): string {
    if (isIRLiteral(node)) return this.generateLiteral(node);
    if (isIRIdentifier(node)) return this.generateIdentifier(node);
    if (isIRBinaryOp(node)) return this.generateBinaryOp(node);
    if (isIRCall(node)) return this.generateCall(node);
    if (isIRInput(node)) {
      const prompt = node.prompt ? `"${node.prompt}"` : '""';
      if (node.targetType === 'int') return `int(input(${prompt}))`;
      if (node.targetType === 'float') return `float(input(${prompt}))`;
      return `input(${prompt})`;
    }
    if (node.type === 'unary_op') {
      const unary = node as IRUnaryOp;
      const operand = this.generateExpression(unary.operand);
      if (unary.operator === '!') return `not ${operand}`;
      if (unary.operator === '++_post' || unary.operator === '++') return `${operand} + 1`;
      if (unary.operator === '--_post' || unary.operator === '--') return `${operand} - 1`;
      return `${unary.operator}${operand}`;
    }
    return '';
  }

  private generateLiteral(node: IRLiteral): string {
    if (node.dataType === 'string') {
      const value = String(node.value);
      
      // Check for f-string interpolation {var}
      if (value.includes('{') && value.includes('}')) {
        const cleanValue = value.replace(/\\n$/, '');
        return `f"${cleanValue}"`;
      }
      
      // Check for C-style format specifiers - return as regular string
      const cleanValue = value.replace(/\\n$/, '');
      return `"${cleanValue}"`;
    }
    if (node.dataType === 'bool') {
      return node.value ? 'True' : 'False';
    }
    if (node.value === 'null') return 'None';
    if (node.value === 'true') return 'True';
    if (node.value === 'false') return 'False';
    return String(node.value);
  }

  private generateIdentifier(node: IRIdentifier): string {
    if (node.name === 'this') return 'self';
    return node.name;
  }

  private generateBinaryOp(node: IRBinaryOp): string {
    const left = this.generateExpression(node.left);
    const right = this.generateExpression(node.right);
    
    let op = node.operator;
    if (op === '&&') op = 'and';
    if (op === '||') op = 'or';
    
    // Assignment operators
    if (op === '=' || op === '+=' || op === '-=' || op === '*=' || op === '/=') {
      return `${left} ${op} ${right}`;
    }
    
    return `${left} ${op} ${right}`;
  }

  private generateCall(node: IRCall): string {
    const args = node.args.map(arg => this.generateExpression(arg)).join(', ');
    
    // Type conversion
    if (node.callee === 'int' || node.callee === 'float' || node.callee === 'str') {
      return `${node.callee}(${args})`;
    }
    
    if (node.isMethod && node.object) {
      const obj = node.object === 'this' ? 'self' : node.object;
      return `${obj}.${node.callee}(${args})`;
    }
    
    return `${node.callee}(${args})`;
  }

  private getDefaultValue(type: string): string {
    switch (type) {
      case 'int': return '0';
      case 'float':
      case 'double': return '0.0';
      case 'string': return '""';
      case 'bool': return 'False';
      default: return 'None';
    }
  }
}
