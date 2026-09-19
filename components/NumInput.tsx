"use client";
import { useEffect, useState } from "react";
import { parseNum } from "@/lib/format.ts";

/**
 * Campo numérico que aceita vírgula (como o teclado brasileiro).
 * Com `aoSair`, só confirma o valor ao sair do campo ou apertar Enter
 * (evita a tela se reorganizar a cada tecla).
 */
export function NumInput({
  value,
  onChange,
  id,
  placeholder,
  aoSair = false,
}: {
  value: number | null;
  onChange: (n: number) => void;
  id?: string;
  placeholder?: string;
  aoSair?: boolean;
}) {
  const show = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
  const [txt, setTxt] = useState(show(value));
  useEffect(() => {
    setTxt((prev) => (parseNum(prev) === value ? prev : show(value)));
  }, [value]);

  const confirmar = () => {
    const n = parseNum(txt);
    if (n != null && n !== value) onChange(n);
  };

  return (
    <input
      id={id}
      inputMode="decimal"
      placeholder={placeholder}
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value);
        if (!aoSair) {
          const n = parseNum(e.target.value);
          if (n != null) onChange(n);
        }
      }}
      onBlur={aoSair ? confirmar : undefined}
      onKeyDown={aoSair ? (e) => e.key === "Enter" && confirmar() : undefined}
    />
  );
}
