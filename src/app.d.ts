declare global {
  namespace App {
    interface Locals {
      authenticated: boolean;
      sessionTokenHash: string | null;
    }
  }
}
export {};
