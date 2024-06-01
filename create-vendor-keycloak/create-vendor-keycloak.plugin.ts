import { LanguageCode, PluginCommonModule, Type, VendurePlugin } from "@vendure/core";

import { shopApiExtensions } from "./api/api-extensions";
import { CreateVendorKeycloakAdminResolver } from "./api/create-vendor-keycloak-admin.resolver";
import { CREATE_VENDOR_KEYCLOAK_PLUGIN_OPTIONS } from "./constants";
import { CreateVendorKeycloakService } from "./services/create-vendor-keycloak.service";
import { PluginInitOptions } from "./types";

@VendurePlugin({
	imports: [PluginCommonModule],
	providers: [{ provide: CREATE_VENDOR_KEYCLOAK_PLUGIN_OPTIONS, useFactory: () => CreateVendorKeycloakPlugin.options }, CreateVendorKeycloakService],
	configuration: (config) => {
		// Plugin-specific configuration
		// such as custom fields, custom permissions,
		// strategies etc. can be configured here by
		// modifying the `config` object.
		config.customFields.Seller.push({
			name: "connectedAccountId",
			label: [{ languageCode: LanguageCode.en, value: "Connected account ID" }],
			description: [{ languageCode: LanguageCode.en, value: "The ID used to process connected payments" }],
			type: "string",
			public: false,
		});
		return config;
	},
	compatibility: "^2.0.0",
	shopApiExtensions: {
		schema: shopApiExtensions,
		resolvers: [CreateVendorKeycloakAdminResolver],
	},
})
export class CreateVendorKeycloakPlugin {
	static options: PluginInitOptions;

	static init(options: PluginInitOptions): Type<CreateVendorKeycloakPlugin> {
		this.options = options;
		return CreateVendorKeycloakPlugin;
	}
}
