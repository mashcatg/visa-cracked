declare module "https://esm.sh/@supabase/supabase-js@2.49.1" {
  export function createClient(...args: any[]): any;
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
