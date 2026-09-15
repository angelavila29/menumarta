import Image from "next/image";
import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Image src="/logo.png" alt="" width={112} height={112} priority className="mx-auto mb-4" />
        <h1 className="mb-2 text-center text-4xl font-bold">Sobremesa</h1>
        <p className="mb-8 text-center text-zinc-600">
          Menú semanal y lista de la compra con precios reales.
        </p>
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">
            El enlace no es válido o ha caducado. Pide otro.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
