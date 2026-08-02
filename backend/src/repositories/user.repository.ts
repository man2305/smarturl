import { UserModel, type IUser, type IUserDoc } from '../models/User.model';

/** Data-access layer for users. Controllers/services never touch Mongoose directly. */
export const userRepository = {
  async create(data: Pick<IUser, 'name' | 'email' | 'password'>): Promise<IUserDoc> {
    return UserModel.create(data);
  },

  async findByEmail(email: string): Promise<IUserDoc | null> {
    return UserModel.findOne({ email }).exec();
  },

  /** Password is `select: false` by default; request it explicitly for login. */
  async findByEmailWithPassword(email: string): Promise<IUserDoc | null> {
    return UserModel.findOne({ email }).select('+password').exec();
  },

  async findById(id: string): Promise<IUserDoc | null> {
    return UserModel.findById(id).exec();
  },
};
