import React from "react";
import { Box, VStack, Heading, Text, Pressable, HStack, Icon } from "@gluestack-ui/themed";
import { ExpenseSheet } from "@/constants/types";
import { SheetStatusID } from "@/constants/constants";
import { Trash2 } from "lucide-react-native";

type SheetCardProps = {
	sheet: ExpenseSheet;
	onPress?: () => void;
	onDelete?: (sheet: ExpenseSheet) => void;
};

export default function SheetCard({ sheet, onPress, onDelete }: SheetCardProps) {
	const bgColor =
		sheet.status.id == SheetStatusID.APROBADO
			? "$green400"
			: sheet.status.id == SheetStatusID.RECHAZADO
			? "$red400"
			: "$white";

	return (
		<Box
			w="$full"
			bg={bgColor}
			p={4}
			borderRadius="$lg"
			borderWidth={1}
			borderColor="$coolGray200"
			mb={8}
		>
			<HStack alignItems="center" justifyContent="space-between" space="md">
				<Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1 }}>
					<VStack space="sm">
						<Heading size="sm">{sheet.title}</Heading>

						{sheet.description ? (
							<Text color="$coolGray600">{sheet.description}</Text>
						) : null}

						<HStack space="xs" alignItems="center">
							<Text>Proyecto:</Text>
							<Text fontWeight="$bold">{sheet.project}</Text>
						</HStack>

						<HStack space="xs" alignItems="center">
							<Text>Total:</Text>
							<Text fontWeight="$bold">{sheet.total_amount} €</Text>
						</HStack>

						<HStack space="xs" alignItems="center">
							<Text fontSize="$sm" color="$coolGray500">Creado:</Text>
							<Text fontSize="$sm" color="$coolGray500">{new Date(sheet.create_date).toLocaleDateString()}</Text>
						</HStack>
					</VStack>
				</Pressable>

				<Pressable
					onPress={() => onDelete?.(sheet)}
					accessibilityLabel="Eliminar hoja"
					accessibilityRole="button"
					hitSlop={10}
				>
					<Icon as={Trash2} size="lg" color="$coolGray700" />
				</Pressable>
			</HStack>
		</Box>
	);
}

