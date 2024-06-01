import { Injectable } from "@nestjs/common";
import { CreatePaymentMethodInput, Permission } from "@vendure/common/lib/generated-types";
import { normalizeString } from "@vendure/common/lib/normalize-string";
import {
	Administrator,
	AdministratorService,
	Channel,
	ChannelService,
	ConfigService,
	Customer,
	EntityHydrator,
	ExternalAuthenticationMethod,
	ExternalAuthenticationService,
	InternalServerError,
	Logger,
	PaymentMethodService,
	RequestContext,
	RequestContextService,
	Role,
	RoleService,
	SellerService,
	ShippingMethod,
	ShippingMethodService,
	StockLocation,
	StockLocationService,
	TaxSetting,
	TransactionalConnection,
	User,
	defaultShippingCalculator,
	defaultShippingEligibilityChecker,
	isGraphQlErrorResult,
	manualFulfillmentHandler,
} from "@vendure/core";
import { stripePaymentMethodHandler } from "@vendure/payments-plugin/package/stripe/stripe.handler";
import { AssignPaymentMethodsToChannelInput, ConfigurableOperationInput } from "src/generated/graphql";
import { IsNull } from "typeorm";
import { CreateVendorKeycloakInput, VendorProvisioningDetails } from "../types";

@Injectable()
export class CreateVendorKeycloakService {
	constructor(
		private connection: TransactionalConnection,
		private administratorService: AdministratorService,
		private sellerService: SellerService,
		private roleService: RoleService,
		private channelService: ChannelService,
		private shippingMethodService: ShippingMethodService,
		private configService: ConfigService,
		private stockLocationService: StockLocationService,
		private requestContextService: RequestContextService,
		private paymentMethodService: PaymentMethodService,
		private externalAuthenticationService: ExternalAuthenticationService,
		private entityHydrator: EntityHydrator
	) {}

	private vendorProvisioningDetails: VendorProvisioningDetails = <VendorProvisioningDetails>{};

	async createVendorKeycloak(ctx: RequestContext, createVendorKeycloakInput: CreateVendorKeycloakInput) {
		const superAdminCtx = await this.getSuperAdminContext(ctx);
		const channel = await this.createSellerChannelRoleAdmin(superAdminCtx, createVendorKeycloakInput);
		await this.createSellerStockLocation(superAdminCtx, createVendorKeycloakInput.sellerName, channel);
		await this.createSellerShippingMethod(superAdminCtx, createVendorKeycloakInput, channel);
		await this.createPaymentMethod(superAdminCtx, createVendorKeycloakInput, channel);
		return this.vendorProvisioningDetails;
	}

	// Create the Seller, Channel, 3 roles for Manager, Staff and Volunteer and the first Administrator
	async createSellerChannelRoleAdmin(ctx: RequestContext, createVendorKeycloakInput: CreateVendorKeycloakInput) {
		// Create the seller with a dummy connectedAccountId field
		const seller = await this.sellerService.create(ctx, {
			name: createVendorKeycloakInput.sellerName,
			customFields: {
				connectedAccountId: Math.random().toString(30).substring(3),
			},
		});

		if (seller) {
			Logger.info("Created seller: " + createVendorKeycloakInput.sellerName);
		} else {
			throw new InternalServerError("Could not create seller: " + createVendorKeycloakInput.sellerName);
		}

		// Create the channel
		const defaultChannel = await this.channelService.getDefaultChannel(ctx);
		const channelCode = normalizeString(createVendorKeycloakInput.sellerName, "-");
		const channel = await this.channelService.create(ctx, {
			code: channelCode,
			sellerId: seller.id,
			token: `${channelCode}-token`,
			currencyCode: defaultChannel.defaultCurrencyCode,
			defaultLanguageCode: defaultChannel.defaultLanguageCode,
			pricesIncludeTax: defaultChannel.pricesIncludeTax,
			defaultShippingZoneId: defaultChannel.defaultShippingZone.id,
			defaultTaxZoneId: defaultChannel.defaultTaxZone.id,
		});

		if (isGraphQlErrorResult(channel)) {
			throw new InternalServerError(channel.message);
		} else {
			Logger.info("Created channel: " + channel.code);
			this.vendorProvisioningDetails!.channelToken! = channel.token;
		}

		// Create 3 roles for the Manager, Staff and Volunteer
		const superAdminRole = await this.roleService.getSuperAdminRole(ctx);
		await this.roleService.assignRoleToChannel(ctx, superAdminRole.id, channel.id);

		const managerRole = await this.roleService.create(ctx, {
			code: `${channelCode}-manager`,
			channelIds: [channel.id],
			description: `Manager of ${createVendorKeycloakInput.sellerName}`,
			permissions: [
				// Ability to create more administrators and all permissions for managing the catalog and orders
				Permission.CreateAdministrator,
				Permission.ReadAdministrator,
				Permission.UpdateAdministrator,
				Permission.CreateCatalog,
				Permission.UpdateCatalog,
				Permission.ReadCatalog,
				Permission.DeleteCatalog,
				Permission.ReadOrder,
				Permission.CreateOrder,
				Permission.UpdateOrder,
				Permission.DeleteOrder,
				Permission.ReadShippingMethod,
				Permission.UpdateShippingMethod,
				Permission.ReadPromotion,
				Permission.ReadCustomer,
				Permission.CreateTag,
				Permission.ReadTag,
				Permission.UpdateTag,
				Permission.DeleteTag,
			],
		});

		if (managerRole) {
			Logger.info("Created Manager roleId: " + managerRole.id);
			this.vendorProvisioningDetails.managerRoleId! = managerRole.id;
			this.vendorProvisioningDetails.managerRoleCode! = managerRole.code;
		} else {
			throw new InternalServerError("Could not create Manager role for channel: " + channel.token);
		}

		const staffRole = await this.roleService.create(ctx, {
			code: `${channelCode}-staff`,
			channelIds: [channel.id],
			description: `Staff of ${createVendorKeycloakInput.sellerName}`,
			permissions: [
				// No ability to create more administrators and all permissions for managing the catalog and orders
				Permission.CreateAdministrator,
				Permission.ReadAdministrator,
				Permission.UpdateAdministrator,
				Permission.CreateCatalog,
				Permission.UpdateCatalog,
				Permission.ReadCatalog,
				Permission.CreateOrder,
				Permission.ReadOrder,
				Permission.UpdateOrder,
				Permission.ReadPromotion,
				Permission.ReadCustomer,
				Permission.CreateTag,
				Permission.ReadTag,
				Permission.UpdateTag,
			],
		});

		if (staffRole) {
			Logger.info("Created Staff roleId: " + staffRole.id);
			this.vendorProvisioningDetails.staffRoleId! = staffRole.id;
			this.vendorProvisioningDetails.staffRoleCode! = staffRole.code;
		} else {
			throw new InternalServerError("Could not create Staff role for channel: " + channel.token);
		}

		const volunteerRole = await this.roleService.create(ctx, {
			code: `${channelCode}-volunteer`,
			channelIds: [channel.id],
			description: `Volunteer of ${createVendorKeycloakInput.sellerName}`,
			permissions: [
				// No ability to create more administrators and limited permissions for managing the catalog and orders
				Permission.CreateCatalog,
				Permission.UpdateCatalog,
				Permission.ReadCatalog,
				Permission.ReadOrder,
				Permission.UpdateOrder,
				Permission.ReadPromotion,
				Permission.ReadCustomer,
				Permission.CreateTag,
				Permission.ReadTag,
				Permission.UpdateTag,
			],
		});

		if (volunteerRole) {
			Logger.info("Created Volunteer roleId: " + volunteerRole.id);
			this.vendorProvisioningDetails.volunteerRoleId! = volunteerRole.id;
			this.vendorProvisioningDetails.volunteerRoleCode! = volunteerRole.code;
		} else {
			throw new InternalServerError("Could not create Volunteer role for channel: " + channel.token);
		}

		//Create the first administrator using an existing customer email address thats using Keycloak auth
		let strategyName = "keycloakAdmin";
		const customer = await this.connection.getRepository(ctx, Customer).findOneBy({
			emailAddress: createVendorKeycloakInput.emailAddress,
		});

		if (!customer) {
			Logger.error(`Could not find ` + createVendorKeycloakInput.emailAddress + ` customer`);
			return channel;
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

		// Get the merchant role using the role code that was passed in
		// to the mutation
		const role = await this.connection.getRepository(ctx, Role).findOne({
			where: { code: this.vendorProvisioningDetails.managerRoleCode },
		});

		if (!role) {
			Logger.error(`Could not find ` + this.vendorProvisioningDetails.managerRoleCode + ` role`);
			return channel;
		} else {
			Logger.info(`Found role for roleCode:` + role.code);
		}

		// Check if the user is already an administrator
		const existingAdmin = await this.connection.getRepository(ctx, Administrator).findOneBy({
			emailAddress: createVendorKeycloakInput.emailAddress,
			deletedAt: IsNull(),
		});

		if (existingAdmin) {
			Logger.info(
				"The user with id: " +
					existingAdmin.id +
					" email address: " +
					createVendorKeycloakInput.emailAddress +
					" is already an administrator. Checking if the role:" +
					this.vendorProvisioningDetails.managerRoleCode +
					" needs to be added."
			);

			// Apply the role to the existing administrator
			const assignRole = await this.administratorService.assignRole(ctx, existingAdmin.id, role.id);

			if (!assignRole) {
				Logger.error(`Could not assign the role:` + role.code + " to existing user:" + createVendorKeycloakInput.emailAddress);
				return channel;
			}
		} else {
			// Create a new administrator and apply the roles
			// If the role and user are found then create an administrator account for user with the role that was specified
			// If the user already exists as an administrator, and a new role is being assigned
			// only update the role

			const createAdmin = await this.externalAuthenticationService.createAdministratorAndUser(ctx, {
				strategy: strategyName,
				externalIdentifier: externalId,
				identifier: createVendorKeycloakInput.emailAddress,
				emailAddress: createVendorKeycloakInput.emailAddress,
				firstName: customer.firstName ?? createVendorKeycloakInput.emailAddress,
				lastName: customer.lastName ?? createVendorKeycloakInput.emailAddress,
				roles: [role],
			});

			if (!createAdmin) {
				Logger.error(`Could not create admin account for ` + customer.emailAddress + ` customer`);
				return channel;
			}
		}

		Logger.info("User " + createVendorKeycloakInput.emailAddress + " has been added as an administrator with role: " + role.code);

		return channel;
	}

	// Create stock location for the seller
	private async createSellerStockLocation(ctx: RequestContext, sellerName: string, channel: Channel) {
		const stockLocation = await this.stockLocationService.create(ctx, {
			name: `${sellerName} Warehouse`,
		});
		await this.channelService.assignToChannels(ctx, StockLocation, stockLocation.id, [channel.id]);
	}

	// Create two shipping methods, one that is free and one with the Vendor + Platform fees
	private async createSellerShippingMethod(ctx: RequestContext, createVendorKeycloakInput: CreateVendorKeycloakInput, channel: Channel) {
		const defaultChannel = await this.channelService.getDefaultChannel(ctx);
		const { shippingEligibilityCheckers, shippingCalculators, fulfillmentHandlers } = this.configService.shippingOptions;
		const shopCode = normalizeString(createVendorKeycloakInput.sellerName, "-");
		const checker = shippingEligibilityCheckers.find((c) => c.code === defaultShippingEligibilityChecker.code);
		const calculator = shippingCalculators.find((c) => c.code === defaultShippingCalculator.code);
		const fulfillmentHandler = fulfillmentHandlers.find((h) => h.code === manualFulfillmentHandler.code);
		if (!checker) {
			throw new InternalServerError("Could not find a suitable ShippingEligibilityChecker for the seller");
		}
		if (!calculator) {
			throw new InternalServerError("Could not find a suitable ShippingCalculator for the seller");
		}
		if (!fulfillmentHandler) {
			throw new InternalServerError("Could not find a suitable FulfillmentHandler for the seller");
		}

		// Creating two shipping methods, one is fully free and the other includes Vendor handling fee and
		// the platform administration fee
		const freeShippingMethod = await this.shippingMethodService.create(ctx, {
			code: `${shopCode}-in-store-pickup-free`,
			checker: {
				code: checker.code,
				arguments: [],
			},
			calculator: {
				code: calculator.code,
				// TODO - update these to zero rates and set includes tax to true for free
				// Add second shipping calculator with fee
				arguments: [
					{ name: "rate", value: "0" },
					{ name: "includesTax", value: TaxSetting.include },
					{ name: "taxRate", value: "0" },
				],
			},
			fulfillmentHandler: fulfillmentHandler.code,
			translations: [
				{
					languageCode: defaultChannel.defaultLanguageCode,
					name: `Free in-store pickup for ${createVendorKeycloakInput.sellerName}`,
				},
			],
		});
		await this.channelService.assignToChannels(ctx, ShippingMethod, freeShippingMethod.id, [channel.id]);

		const serviceFeeShippingMethod = await this.shippingMethodService.create(ctx, {
			code: `${shopCode}-in-store-pickup-service-fee`,
			checker: {
				code: checker.code,
				arguments: [],
			},
			calculator: {
				code: calculator.code,
				arguments: [
					{ name: "rate", value: (createVendorKeycloakInput.vendorHandlingFee + createVendorKeycloakInput.platformHandlingFee).toString() },
					{ name: "includesTax", value: TaxSetting.include },
					{ name: "taxRate", value: "0" },
				],
			},
			fulfillmentHandler: fulfillmentHandler.code,
			translations: [
				{
					languageCode: defaultChannel.defaultLanguageCode,
					name: `In-store pickup with Vendor and Platform service fee for ${createVendorKeycloakInput.sellerName}`,
				},
			],
		});
		await this.channelService.assignToChannels(ctx, ShippingMethod, serviceFeeShippingMethod.id, [channel.id]);
	}

	// Create Stripe payment method for the channel
	private async createPaymentMethod(ctx: RequestContext, createVendorKeycloakInput: CreateVendorKeycloakInput, channel: Channel) {
		let createPaymentMethodInput: CreatePaymentMethodInput = <CreatePaymentMethodInput>{};
		const defaultChannel = await this.channelService.getDefaultChannel(ctx);
		createPaymentMethodInput.code = normalizeString(createVendorKeycloakInput.sellerName + " stripe", "-");
		createPaymentMethodInput.translations = [
			{
				languageCode: defaultChannel.defaultLanguageCode,
				name: createVendorKeycloakInput.sellerName + " Stripe Payment Method",
			},
		];
		createPaymentMethodInput.enabled = true;
		createPaymentMethodInput.handler = <ConfigurableOperationInput>{};
		createPaymentMethodInput.handler.code = stripePaymentMethodHandler.code;
		createPaymentMethodInput.handler.arguments = [
			{ name: "apiKey", value: createVendorKeycloakInput.stripeAPISecret },
			{ name: "webhookSecret", value: createVendorKeycloakInput.stripeWebhookSecret },
		];

		let paymentMethod = await this.paymentMethodService.create(ctx, createPaymentMethodInput);
		let assignPaymentMethodsToChannelInput: AssignPaymentMethodsToChannelInput = <AssignPaymentMethodsToChannelInput>{};
		assignPaymentMethodsToChannelInput.channelId = channel.id.toString();
		assignPaymentMethodsToChannelInput.paymentMethodIds = [paymentMethod.id.toString()];
		await this.paymentMethodService.assignPaymentMethodsToChannel(ctx, assignPaymentMethodsToChannelInput);
	}

	// Get the superAdmin context to perform all the provisioning actions
	private async getSuperAdminContext(ctx: RequestContext): Promise<RequestContext> {
		const { superadminCredentials } = this.configService.authOptions;
		const superAdminUser = await this.connection.getRepository(ctx, User).findOne({
			where: {
				identifier: superadminCredentials.identifier,
			},
		});
		return this.requestContextService.create({
			apiType: "shop",
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			user: superAdminUser!,
		});
	}
}
