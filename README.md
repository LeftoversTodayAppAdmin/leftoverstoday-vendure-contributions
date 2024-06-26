# leftoverstoday-vendure-contributions
OSS contributions from Leftovers.today, Inc. to Vendure.io

**Keycloak authentication strategies and plugins:**
1. Customer keycloak auth strategy with creation of a new customer if they dont exist
2. Admin keycloak auth strategy with only login
3. Admin API for a current admin to provision a new keycloak auth admin account for an existing keycloak auth customer email address and roleCode. The same Keycloak auth account can now be used to login to both the Shop and Admin accounts on Vendure, allowing for SSO.
4. Shop API to allow a keycloak auth customer to self provision a new Seller with all the required entities (Seller, Channel, Stock, Shipping, Stripe Payment, Roles etc.) and create themselves as the first admin for the channel with the role of Manager who can now create other admins from keycloak auth customer accounts.

**1. Pre-requisites**

Stripe plugin for auth, Stripe account to get the API secret and Webhook secret

https://docs.vendure.io/reference/core-plugins/payments-plugin/stripe-plugin/

**2. Move the folders in this repo to plugins folder**

**3. Add to ```src/environment.d.ts```**

```KEYCLOAK_USERINFO_URL: string;```

**4. Add to .env file**

```KEYCLOAK_USERINFO_URL=http://<host>:8080/realms/<realm_name>/protocol/openid-connect/userinfo```

**5. Add to vendure-config.ts**

```jsx
import { KeycloakAdminAuthenticationStrategy } from "./plugins/authentication-keycloak/keycloak-admin-authentication-strategy";
import { KeycloakCustomerAuthenticationStrategy } from "./plugins/authentication-keycloak/keycloak-customer-authentication-strategy";
import { CreateAdministratorKeycloakPlugin } from "./plugins/create-administrator-keycloak/create-administrator-keycloak.plugin";
import { CreateVendorKeycloakPlugin } from "./plugins/create-vendor-keycloak/create-vendor-keycloak.plugin";

authOptions: {
...
  shopAuthenticationStrategy: [new KeycloakCustomerAuthenticationStrategy()],
  adminAuthenticationStrategy: [new KeycloakAdminAuthenticationStrategy()],
},

plugins: [
...
  CreateAdministratorKeycloakPlugin.init(),
  CreateVendorKeycloakPlugin.init({}),
 ],
```
