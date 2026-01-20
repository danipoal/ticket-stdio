import React from "react";
import { Pressable, Box, Icon } from "@gluestack-ui/themed";
import { Plus } from "lucide-react-native";

type AddButtonProps = {
	onPress?: () => void;
	size?: number; // diámetro del botón
	bg?: string; // token de color gluestack
	iconColor?: string; // color del icono
	testID?: string;
	accessibilityLabel?: string;
};

export default function AddButton({
	onPress,
	size = 40,
	bg = "$green500",
	iconColor = "$white",
	testID = "add-button",
	accessibilityLabel = "Añadir",
}: AddButtonProps) {
	return (
		<Pressable
			onPress={onPress}
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
		>
			<Box
				w={size}
				h={size}
				borderRadius="$full"
				bg={bg}
				alignItems="center"
				justifyContent="center"
			>
				<Icon as={Plus} color={iconColor} size="lg" />
			</Box>
		</Pressable>
	);
}

