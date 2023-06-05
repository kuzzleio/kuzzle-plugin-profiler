export type Stack<T> = {
  type: 'root' | 'node';
  value?: T | undefined;
  children: Stack<T>[];
}

export class StackBuilder<T> {
  private root: Stack<T> = {
    type: 'root',
    children: [],
  }
  private stack: Stack<T>[] = [];

  constructor() {
    
  }
  
  public push(value: T) {
    const child: Stack<T> = {
      type: 'node',
      value,
      children: [],
    };

    if (this.stack.length === 0) {
      this.root.children.push(child);
    } else {
      this.stack[this.stack.length - 1].children.push(child);
    }
    this.stack.push(child);
  }

  public getCurrent(): T | undefined {
    if (this.stack.length === 0) {
      return undefined;
    }
    return this.stack[this.stack.length - 1].value;
  }

  public pop(): void {
    this.stack.pop();
  }

  public getRoot(): Stack<T> {
    return this.root;
  }

  public getStack(): Stack<T>[] {
    return this.stack;
  }

}