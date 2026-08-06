declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
declare module "supabase" {
  export function createClient(...args: any[]): any;
}
declare module "web-push" {
  const webpush: any;
  export default webpush;
}
