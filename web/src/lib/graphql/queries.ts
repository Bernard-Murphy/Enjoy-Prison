import { gql } from "graphql-tag";

export const ME_QUERY = gql`
  query Me {
    me {
      id
      username
      displayName
      avatar
      email
    }
  }
`;
