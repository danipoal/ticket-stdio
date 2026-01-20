import React, { useMemo, useState } from "react";
import {
	Box,
	VStack,
	HStack,
	Heading,
	FormControl,
	FormControlLabel,
	FormControlLabelText,
	Input,
	InputField,
	Textarea,
	TextareaInput,
	Button,
	ButtonText,
	Select,
	SelectTrigger,
	SelectInput,
	SelectIcon,
	SelectPortal,
	SelectBackdrop,
	SelectContent,
	SelectDragIndicator,
	SelectDragIndicatorWrapper,
	SelectItem,
	Pressable,
	Icon,
} from "@gluestack-ui/themed";
import { SheetStatusID } from "@/constants/constants";
import { X } from "lucide-react-native";

type CreateSheetValues = {
	title: string;
	description: string;
	project: string;
	create_date: string; // ISO string o fecha libre
	approval_date: string; // ISO string sin hora o vacío
	status_id: number;
};

type CreateSheetViewProps = {
	onClose?: () => void;
	onCreate?: (values: CreateSheetValues) => void;
};

export default function CreateSheetView({ onClose, onCreate }: CreateSheetViewProps) {
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [project, setProject] = useState("");
	const [createDate, setCreateDate] = useState<string>(new Date().toISOString());
	const [approvalDate, setApprovalDate] = useState<string>("");
	const [statusId, setStatusId] = useState<number>(SheetStatusID.PENDIENTE);

	const statusOptions = useMemo(
		() => [
			{ label: "Aprobado", value: SheetStatusID.APROBADO },
			{ label: "Pendiente", value: SheetStatusID.PENDIENTE },
			{ label: "Rechazado", value: SheetStatusID.RECHAZADO },
		],
		[]
	);

	const handleCreate = () => {
		const payload: CreateSheetValues = {
			title,
			description,
			project,
			create_date: createDate,
			approval_date: approvalDate,
			status_id: statusId,
		};
		onCreate?.(payload);
	};

	return (
		<Box w="$full" alignItems="center" justifyContent="center">
			<Box
				position="relative"
				w="$full"
				maxWidth={640}
				bg="$white"
				borderWidth={1}
				borderColor="$coolGray200"
				borderRadius="$lg"
				p={12}
			>
				<Pressable
					onPress={() => onClose?.()}
					accessibilityLabel="Cerrar"
					accessibilityRole="button"
					position="absolute"
					right="$3"
					top="$3"
					zIndex={1}
					hitSlop={10}
				>
					<Icon as={X} size="lg" color="$coolGray700" />
				</Pressable>

				<VStack space="lg">
					<Heading size="lg" textAlign="center">
						Nueva hoja de gastos
					</Heading>

				<FormControl>
					<FormControlLabel>
						<FormControlLabelText>Título</FormControlLabelText>
					</FormControlLabel>
					<Input>
						<InputField
							value={title}
							onChangeText={setTitle}
							placeholder="Introduce un título"
						/>
					</Input>
				</FormControl>

				<FormControl>
					<FormControlLabel>
						<FormControlLabelText>Descripción</FormControlLabelText>
					</FormControlLabel>
					<Textarea>
						<TextareaInput
							value={description}
							onChangeText={setDescription}
							placeholder="Descripción opcional"
						/>
					</Textarea>
				</FormControl>

				<FormControl>
					<FormControlLabel>
						<FormControlLabelText>Proyecto</FormControlLabelText>
					</FormControlLabel>
					<Input>
						<InputField
							value={project}
							onChangeText={setProject}
							placeholder="Nombre del proyecto"
						/>
					</Input>
				</FormControl>

				<FormControl>
					<FormControlLabel>
						<FormControlLabelText>Fecha de creación (ISO)</FormControlLabelText>
					</FormControlLabel>
					<Input>
						<InputField
							value={createDate}
							onChangeText={setCreateDate}
							placeholder="YYYY-MM-DDTHH:mm:ss.sssZ"
							autoCapitalize="none"
						/>
					</Input>
				</FormControl>

				<FormControl>
					<FormControlLabel>
						<FormControlLabelText>Fecha de aprobación (sin hora)</FormControlLabelText>
					</FormControlLabel>
					<Input>
						<InputField
							value={approvalDate}
							onChangeText={setApprovalDate}
							placeholder="YYYY-MM-DD"
							autoCapitalize="none"
						/>
					</Input>
				</FormControl>

				<FormControl>
					<FormControlLabel>
						<FormControlLabelText>Estado</FormControlLabelText>
					</FormControlLabel>
					<Select selectedValue={String(statusId)} onValueChange={(v: string) => setStatusId(Number(v))}>
						<SelectTrigger>
							<SelectInput placeholder="Selecciona estado" />
							<SelectIcon mr="$3" />
						</SelectTrigger>
						<SelectPortal>
							<SelectBackdrop />
							<SelectContent>
								<SelectDragIndicatorWrapper>
									<SelectDragIndicator />
								</SelectDragIndicatorWrapper>
								{statusOptions.map((opt) => (
									<SelectItem key={opt.value} label={opt.label} value={String(opt.value)} />
								))}
							</SelectContent>
						</SelectPortal>
					</Select>
				</FormControl>

					<HStack space="sm" justifyContent="center">
						<Button onPress={handleCreate}>
							<ButtonText>Crear</ButtonText>
						</Button>
					</HStack>
				</VStack>
			</Box>
		</Box>
	);
}