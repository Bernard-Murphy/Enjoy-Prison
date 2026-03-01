import { ApolloServer } from "@apollo/server";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export function createApolloServer() {
  return new ApolloServer({ schema });
}
