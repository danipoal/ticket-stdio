import React from "react";
import { ExpenseSheet } from "@/constants/types";
import SheetListItem from "./SheetListItem";

type SheetCardProps = {
	sheet: ExpenseSheet;
	onPress?: () => void;
	/** Si no se pasa, no se muestra la papelera (p. ej. hojas aprobadas). */
	onDelete?: (sheet: ExpenseSheet) => void;
};

/**
 * Tarjeta de hoja en la lista de movil. Usa el mismo diseno que la lista de escritorio (barra de color por estado,
 * importe destacado, iconos): antes eran tarjetas de color solido verde/rojo con texto plano.
 */
export default function SheetCard({ sheet, onPress, onDelete }: SheetCardProps) {
	return <SheetListItem sheet={sheet} onPress={onPress} onDelete={onDelete} />;
}
