// Remonta a cada troca de página e dispara a animação de entrada (.page em globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page">{children}</div>;
}
