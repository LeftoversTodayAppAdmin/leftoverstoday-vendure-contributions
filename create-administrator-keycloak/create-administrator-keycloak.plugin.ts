import { PluginCommonModule, Type, VendurePlugin } from "@vendure/core";

import { CREATE_ADMINISTRATOR_KEYCLOAK_PLUGIN_OPTIONS } from "./constants";
// import { PluginInitOptions } from './types';
import { adminApiExtensions } from "./api/api-extensions";
import { CreateAdministratorKeycloakAdminResolver } from "./api/create-administrator-keycloak-admin.resolver";
import { CreateAdministratorKeycloak } from "./services/create-administrator-keycloak";

@VendurePlugin({
	imports: [PluginCommonModule],
	providers: [
		{ provide: CREATE_ADMINISTRATOR_KEYCLOAK_PLUGIN_OPTIONS, useFactory: () => CreateAdministratorKeycloakPlugin },
		CreateAdministratorKeycloak,
	],
	configuration: (config) => {
		// Plugin-specific configuration
		// such as custom fields, custom permissions,
		// strategies etc. can be configured here by
		// modifying the `config` object.
		return config;
	},
	compatibility: "^2.0.0",
	adminApiExtensions: {
		schema: adminApiExtensions,
		resolvers: [CreateAdministratorKeycloakAdminResolver],
	},
})
export class CreateAdministratorKeycloakPlugin {
	// static options: PluginInitOptions;

	static init(): Type<CreateAdministratorKeycloakPlugin> {
		// this.options = options;
		return CreateAdministratorKeycloakPlugin;
	}
}
