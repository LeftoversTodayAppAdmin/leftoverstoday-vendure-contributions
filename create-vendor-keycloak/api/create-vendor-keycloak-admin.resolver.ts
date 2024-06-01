import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { Permission } from "@vendure/common/lib/generated-types";
import { Allow, Ctx, RequestContext, Transaction } from "@vendure/core";
import { CreateVendorKeycloakService } from "../services/create-vendor-keycloak.service";
import { CreateVendorKeycloakInput, VendorProvisioningDetails } from "../types";

@Resolver()
export class CreateVendorKeycloakAdminResolver {
	constructor(private createVendorKeycloakService: CreateVendorKeycloakService) {}

	@Mutation()
	@Transaction()
	@Allow(Permission.Authenticated)
	async createVendorKeycloak(
		@Ctx() ctx: RequestContext,
		@Args()
		args: {
			input: CreateVendorKeycloakInput;
		}
	): Promise<VendorProvisioningDetails | false> {
		return this.createVendorKeycloakService.createVendorKeycloak(ctx, args.input);
	}
}
