import { Args, Mutation, Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { Permission } from "@vendure/common/lib/generated-types";
import { Allow, Ctx, ExternalAuthenticationMethod, RequestContext, Transaction } from "@vendure/core";
import { CreateAdministratorKeycloak } from "../services/create-administrator-keycloak";

@Resolver("AuthenticationMethod")
export class CreateAdministratorKeycloakAdminResolver {
	constructor(private createAdministratorKeycloakService: CreateAdministratorKeycloak) {}
	@ResolveField()
	externalIdentifier(@Ctx() ctx: RequestContext, @Parent() authenticationMethod: ExternalAuthenticationMethod) {
		return authenticationMethod ? authenticationMethod.externalIdentifier : "";
	}
	@Mutation()
	@Transaction()
	@Allow(Permission.CreateAdministrator)
	async createAdministratorKeycloak(
		@Ctx() ctx: RequestContext,
		@Args() args: { input: { emailAddress: string; roleCode: string } }
	): Promise<boolean | false> {
		return this.createAdministratorKeycloakService.createAdministratorKeycloak(ctx, args.input);
	}
}
