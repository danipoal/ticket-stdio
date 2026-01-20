import React from "react";
import { Box, VStack, Heading, Text, Pressable } from "@gluestack-ui/themed";
import { ExpenseSheet } from "@/constants/types";
import { SheetStatusID } from "@/constants/constants";

type SheetCardProps = {
	sheet: ExpenseSheet;
	onPress?: () => void;
};

export default function SheetCard({ sheet, onPress }: SheetCardProps) {
	const bgColor =
		sheet.status.id == SheetStatusID.APROBADO
			? "$green400"
			: sheet.status.id == SheetStatusID.RECHAZADO
			? "$red400"
			: "$white";

	return (
		<Pressable onPress={onPress} accessibilityRole="button">
			<Box
				w="$full"
				bg={bgColor}
				p={4}
				borderRadius="$lg"
				borderWidth={1}
				borderColor="$coolGray200"
				mb={8}
			>
				<VStack space="sm">
					<Heading size="sm">{sheet.title}</Heading>

					{sheet.description && (
						<Text color="$coolGray600">{sheet.description}</Text>
					)}

					<Text>
						Proyecto:{" "}
						<Text fontWeight="$bold">{sheet.project}</Text>
					</Text>

					<Text>
						Total:{" "}
						<Text fontWeight="$bold">{sheet.total_amount} €</Text>
					</Text>

					<Text fontSize="$sm" color="$coolGray500">
						Creado:{" "}
						{new Date(sheet.create_date).toLocaleDateString()}
					</Text>
				</VStack>
			</Box>
		</Pressable>
	);
}

