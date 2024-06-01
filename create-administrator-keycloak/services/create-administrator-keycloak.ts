import { Injectable } from "@nestjs/common";
import {
	Administrator,
	AdministratorService,
	Customer,
	EntityHydrator,
	ExternalAuthenticationMethod,
	ExternalAuthenticationService,
	Logger,
	RequestContext,
	Role,
	TransactionalConnection,
} from "@vendure/core";
import { IsNull } from "typeorm";
import { CreateAdministratorKeycloakInput } from "../types";

@Injectable()
export class CreateAdministratorKeycloak {
	readonly strategyName = "keycloakAdmin";

	constructor(
		private connection: TransactionalConnection,
		private externalAuthenticationService: ExternalAuthenticationService,
		private administratorService: AdministratorService,
		private entityHydrator: EntityHydrator
	) {}

	async createAdministratorKeycloak(ctx: RequestContext, data: CreateAdministratorKeycloakInput): Promise<boolean | false> {
		// All new users are first created in Keycloak and a customer account is created for them
		// on Vendure using the keycloak-customer-authentication-strategy
		// Fetch the one customer account for the exact email address match
		const customer = await this.connection.getRepository(ctx, Customer).findOneBy({
			emailAddress: data.emailAddress,
		});

		if (!customer) {
			Logger.error(`Could not find ` + data.emailAddress + ` customer`);
			return false;
		} else {
			Logger.info(`Found ` + customer.emailAddress + ` customer`);
		}

		// Hydrate all the joined entities so that it fetches the authenticationMethods for the user
		await this.entityHydrator.hydrate(ctx, customer, {
			relations: ["user.authenticationMethods"],
		});

		const externalId =
			customer.user?.authenticationMethods[0] instanceof ExternalAuthenticationMethod
				? customer.user.authenticationMethods[0].externalIdentifier
				: "";

		// Get the merchant role using the role code that was passed in to the mutation
		const role = await this.connection.getRepository(ctx, Role).findOne({
			where: { code: data.roleCode },
		});

		if (!role) {
			Logger.error(`Could not find ` + data.roleCode + ` role`);
			return false;
		} else {
			Logger.info(`Found role for roleCode:` + role.code);
		}

		// Check if the user is already an administrator
		const existingAdmin = await this.connection.getRepository(ctx, Administrator).findOneBy({
			emailAddress: data.emailAddress,
			deletedAt: IsNull(),
		});

		if (existingAdmin) {
			Logger.info(
				"The user with id: " +
					existingAdmin.id +
					" email address: " +
					data.emailAddress +
					" is already an administrator. Checking if the role:" +
					data.roleCode +
					" needs to be added."
			);

			// Apply the role to the existing administrator
			const assignRole = await this.administratorService.assignRole(ctx, existingAdmin.id, role.id);

			if (!assignRole) {
				Logger.error(`Could not assign the role:` + role.code + " to existing user:" + data.emailAddress);
				return false;
			}
		} else {
			// Create a new administrator and apply the roles
			// If the role and user are found then create an administrator account for
			// user with the role that was specified
			// If the user already exists as an administrator, and a new role is being assigned
			// only update the role

			const createAdmin = await this.externalAuthenticationService.createAdministratorAndUser(ctx, {
				strategy: this.strategyName,
				externalIdentifier: externalId,
				identifier: data.emailAddress,
				emailAddress: data.emailAddress,
				firstName: customer.firstName ?? data.emailAddress,
				lastName: customer.lastName ?? data.emailAddress,
				roles: [role],
			});

			if (!createAdmin) {
				Logger.error(`Could not create admin account for ` + customer.emailAddress + ` customer`);
				return false;
			}
		}

		Logger.info("User " + data.emailAddress + " has been added as an administrator with role: " + role.code);

		return true;
	}
}
