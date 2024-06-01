/**
 * @description
 * The plugin can be configured using the following options:
 */
export type PluginInitOptions = {};

export interface CreateAdministratorKeycloakInput {
	emailAddress: string;
	roleCode: string;
}
