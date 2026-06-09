import { faker } from "@faker-js/faker";

export interface IUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface IPost {
  id: string;
  authorId: string;
  title: string;
  content: string;
}

export interface IComment {
  id: string;
  postId: string;
  authorId: string;
  comment: string;
}

export const Users = new Map<string, IUser>();
export const Posts = new Map<string, IPost>();
export const Comments = new Map<string, IComment>();

faker.seed(123);

// Create 100 users, posts and comments
for (let i = 1; i <= 100; i += 1) {
  Users.set(String(i), {
    id: String(i),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
  });

  Posts.set(String(i), {
    id: String(i),
    authorId: String(faker.number.int({ min: 1, max: 100 })),
    title: faker.lorem.text(),
    content: faker.lorem.paragraphs(2),
  });

  Comments.set(String(i), {
    id: String(i),
    authorId: String(faker.number.int({ min: 1, max: 100 })),
    postId: String(faker.number.int({ min: 1, max: 100 })),
    comment: faker.lorem.text(),
  });
}
