declare module 'expo-sharing';
declare module 'expo-image-picker';
declare module 'expo-file-system' {
	export const documentDirectory: string | null;
	export const cacheDirectory: string | null;
	export function downloadAsync(
		uri: string,
		fileUri: string,
		options?: any,
		callback?: any
	): Promise<{ uri: string }>;
	export function getContentUriAsync(fileUri: string): Promise<string>;
	const FileSystem: any;
	export default FileSystem;
}
