import gql from "graphql-tag";

export const adminApiExtensions = gql`
	extend type AuthenticationMethod {
		externalIdentifier: String!
	}

	input CreateAdministratorKeycloakInput {
		emailAddress: String!
		roleCode: String!
	}

	extend type Mutation {
		createAdministratorKeycloak(input: CreateAdministratorKeycloakInput!): Boolean!
	}
`;
