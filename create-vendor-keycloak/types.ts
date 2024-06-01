import { ID } from "@vendure/core";

/**
 * @description
 * The plugin can be configured using the following options:
 */
export interface PluginInitOptions {
	// exampleOption?: string;
}

export interface CreateVendorKeycloakInput {
	sellerName: string;
	emailAddress: string;
	vendorHandlingFee: number;
	platformHandlingFee: number;
	stripeAPISecret: string;
	stripeWebhookSecret: string;
}

export interface VendorProvisioningDetails {
	channelToken: string;
	managerRoleId: ID;
	managerRoleCode: string;
	staffRoleId: ID;
	staffRoleCode: string;
	volunteerRoleId: ID;
	volunteerRoleCode: string;
}
