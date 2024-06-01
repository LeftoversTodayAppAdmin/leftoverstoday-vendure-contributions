import gql from "graphql-tag";

export const shopApiExtensions = gql`
	input CreateVendorKeycloakInput {
		sellerName: String!
		emailAddress: String!
		vendorHandlingFee: Money!
		platformHandlingFee: Money!
		stripeAPISecret: String!
		stripeWebhookSecret: String!
	}

	type VendorProvisioningDetails {
		channelToken: String!
		managerRoleId: ID!
		managerRoleCode: String!
		staffRoleId: ID!
		staffRoleCode: String!
		volunteerRoleId: ID!
		volunteerRoleCode: String!
	}

	extend type Mutation {
		createVendorKeycloak(input: CreateVendorKeycloakInput!): VendorProvisioningDetails!
	}
`;
