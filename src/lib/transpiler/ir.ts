// Intermediate Representation (IR) for language-agnostic AST

export type IRNodeType = 
  | 'program'
  | 'function'
  | 'variable'
  | 'assignment'
  | 'if'
  | 'else'
  | 'for'
  | 'while'
  | 'switch'
  | 'return'
  | 'print'
  | 'input'
  | 'class'
  | 'method'
  | 'call'
  | 'expression'
  | 'binary_op'
  | 'unary_op'
  | 'literal'
  | 'identifier'
  | 'comment'
  | 'break'
  | 'block';

export type DataType = 'int' | 'float' | 'double' | 'string' | 'bool' | 'void' | 'char' | 'auto';

export interface IRNode {
  type: IRNodeType;
  children?: IRNode[];
}

export interface IRProgram extends IRNode {
  type: 'program';
  body: IRNode[];
  imports: string[];
}

export interface IRVariable extends IRNode {
  type: 'variable';
  name: string;
  dataType: DataType;
  value?: IRNode;
  isConst?: boolean;
}

export interface IRAssignment extends IRNode {
  type: 'assignment';
  target: string;
  value: IRNode;
}

export interface IRFunction extends IRNode {
  type: 'function';
  name: string;
  params: IRVariable[];
  returnType: DataType;
  body: IRNode[];
}

export interface IRClass extends IRNode {
  type: 'class';
  name: string;
  members: IRVariable[];
  methods: IRFunction[];
  constructor?: IRFunction;
}

export interface IRIf extends IRNode {
  type: 'if';
  condition: IRNode;
  thenBranch: IRNode[];
  elseBranch?: IRNode[];
  elseIf?: IRIf;
}

export interface IRFor extends IRNode {
  type: 'for';
  init?: IRNode;
  condition?: IRNode;
  update?: IRNode;
  // For Python-style range
  rangeStart?: IRNode;
  rangeEnd?: IRNode;
  rangeStep?: IRNode;
  iterator?: string;
  body: IRNode[];
}

export interface IRWhile extends IRNode {
  type: 'while';
  condition: IRNode;
  body: IRNode[];
}

export interface IRSwitch extends IRNode {
  type: 'switch';
  expression: IRNode;
  cases: { value: IRNode; body: IRNode[] }[];
  defaultBody?: IRNode[];
}

export interface IRBreak extends IRNode {
  type: 'break';
}

export interface IRReturn extends IRNode {
  type: 'return';
  value?: IRNode;
}

export interface IRPrint extends IRNode {
  type: 'print';
  args: IRNode[];
  newline?: boolean;
}

export interface IRInput extends IRNode {
  type: 'input';
  prompt?: string;
  targetVar?: string;
  targetType?: DataType;
}

export interface IRCall extends IRNode {
  type: 'call';
  callee: string;
  args: IRNode[];
  isMethod?: boolean;
  object?: string;
}

export interface IRBinaryOp extends IRNode {
  type: 'binary_op';
  operator: string;
  left: IRNode;
  right: IRNode;
}

export interface IRUnaryOp extends IRNode {
  type: 'unary_op';
  operator: string;
  operand: IRNode;
}

export interface IRLiteral extends IRNode {
  type: 'literal';
  value: string | number | boolean;
  dataType: DataType;
}

export interface IRIdentifier extends IRNode {
  type: 'identifier';
  name: string;
}

export interface IRComment extends IRNode {
  type: 'comment';
  text: string;
  isMultiline?: boolean;
}

export interface IRBlock extends IRNode {
  type: 'block';
  statements: IRNode[];
}

// Type guards
export function isIRProgram(node: IRNode): node is IRProgram {
  return node.type === 'program';
}

export function isIRVariable(node: IRNode): node is IRVariable {
  return node.type === 'variable';
}

export function isIRFunction(node: IRNode): node is IRFunction {
  return node.type === 'function';
}

export function isIRClass(node: IRNode): node is IRClass {
  return node.type === 'class';
}

export function isIRPrint(node: IRNode): node is IRPrint {
  return node.type === 'print';
}

export function isIRLiteral(node: IRNode): node is IRLiteral {
  return node.type === 'literal';
}

export function isIRIdentifier(node: IRNode): node is IRIdentifier {
  return node.type === 'identifier';
}

export function isIRBinaryOp(node: IRNode): node is IRBinaryOp {
  return node.type === 'binary_op';
}

export function isIRFor(node: IRNode): node is IRFor {
  return node.type === 'for';
}

export function isIRIf(node: IRNode): node is IRIf {
  return node.type === 'if';
}

export function isIRCall(node: IRNode): node is IRCall {
  return node.type === 'call';
}

export function isIRReturn(node: IRNode): node is IRReturn {
  return node.type === 'return';
}

export function isIRAssignment(node: IRNode): node is IRAssignment {
  return node.type === 'assignment';
}

export function isIRComment(node: IRNode): node is IRComment {
  return node.type === 'comment';
}

export function isIRWhile(node: IRNode): node is IRWhile {
  return node.type === 'while';
}

export function isIRInput(node: IRNode): node is IRInput {
  return node.type === 'input';
}

export function isIRSwitch(node: IRNode): node is IRSwitch {
  return node.type === 'switch';
}

export function isIRBreak(node: IRNode): node is IRBreak {
  return node.type === 'break';
}
