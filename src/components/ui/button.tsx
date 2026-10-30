import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// `active:scale-[0.97]`: pulsar un botón se nota en el propio botón, en todos a la vez. Es la
// respuesta más barata y más frecuente de la app, así que va aquí y no en cada pantalla.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body font-medium ring-offset-background transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Todo el producto habla el mismo idioma de botones (`src/arcade.css`): el primario
        // es el azul con canto, el contorno es la pieza neutra con su canto claro.
        default: "arc-boton arc-boton-primario",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "arc-boton arc-boton-suave",
        secondary: "arc-boton arc-boton-secundario",
        ghost: "hover:bg-secondary",
        link: "text-primary underline-offset-4 hover:underline",
        // El recorrido del alumno (`src/arcade.css`): azul, amarillo y neutro, con canto.
        arcade: "arc-boton arc-boton-primario",
        arcadeAcento: "arc-boton arc-boton-acento",
        arcadeNeutro: "arc-boton arc-boton-neutro",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 px-3 text-meta",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
        // 44 px de alto como mínimo: son los botones que se pulsan con el pulgar.
        arcade: "h-11 px-5 text-[0.95rem]",
        arcadeLg: "h-[3.25rem] px-6 text-base sm:text-[1.05rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
