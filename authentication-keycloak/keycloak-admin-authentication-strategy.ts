import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import {
	AuthenticationStrategy,
	ExternalAuthenticationService,
	Injector,
	Logger,
	RequestContext,
	TransactionalConnection,
	User,
} from "@vendure/core";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";

export type KeycloakAuthData = {
	token: string;
};

export type OpenIdUserInfo = {
	name: string;
	sub: string;
	email?: string;
	email_verified: boolean;
	preferred_username: string;
	given_name?: string;
	family_name?: string;
};

@Injectable()
export class KeycloakAdminAuthenticationStrategy implements AuthenticationStrategy<KeycloakAuthData> {
	readonly name = "keycloakAdmin";
	private externalAuthenticationService: ExternalAuthenticationService;
	private httpService: HttpService;
	private connection: TransactionalConnection;
	private bearerToken: string;

	init(injector: Injector) {
		this.externalAuthenticationService = injector.get(ExternalAuthenticationService);
		this.httpService = injector.get(HttpService);
		this.connection = injector.get(TransactionalConnection);
	}

	defineInputType(): DocumentNode {
		return gql`
			input KeycloakAuthInput {
				token: String!
			}
		`;
	}

	// Admin authentication with Keycloak. If the admin user does not exist fail authentication
	async authenticate(ctx: RequestContext, data: KeycloakAuthData): Promise<User | false> {
		let userInfo: OpenIdUserInfo;
		this.bearerToken = data.token;

		try {
			const response = await this.httpService
				.get(process.env.KEYCLOAK_USERINFO_URL, {
					headers: {
						Authorization: `Bearer ${this.bearerToken}`,
					},
				})
				.toPromise();
			userInfo = response?.data;
		} catch (e: any) {
			Logger.error(e);
			return false;
		}

		if (!userInfo) {
			return false;
		}

		const user = await this.externalAuthenticationService.findAdministratorUser(ctx, this.name, userInfo.sub);
		if (user) {
			return user;
		} else {
			Logger.error(`Could not find administrator account`);
			return false;
		}
	}
}
