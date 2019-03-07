import jwt from 'jsonwebtoken';
import faker from 'faker';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import { User } from '../../api/models/user';

export async function getStandardToken() {
	return await getToken(false);
};

export async function getAdminToken() {
	return await getToken(true);
};

export async function fakeUserData() {
	let email, emailAlreadyExists;
	do {
		email = faker.internet.email();
		const user = await User.findOne({ email }).exec();
		emailAlreadyExists = !!user;
	} while (emailAlreadyExists);
	const password = faker.internet.password();
	const firstName = faker.name.firstName();
	const lastName = faker.name.lastName();
	return { email, password, firstName, lastName };
};

export async function addUser(email: string, password: string, firstName: string, lastName: string) {
	const hash = getHash(password);
	return await new User({
		_id: new mongoose.Types.ObjectId(),
		email,
		password: hash,
		firstName,
		lastName,
		admin: false,
	}).save();
};

export async function deleteUser(user: any) {
	return await User.findOneAndDelete({ email: user.email }).exec();
};

export async function getRandomExistingEmail() {
	const count = await User.count({}).exec();
	const random = Math.floor(Math.random() * count);
	const user = await User.findOne().skip(random).exec();
	return user!.email;
};

async function getToken(isAdmin: boolean) {
		const user = await User.findOne().where('admin', isAdmin).select('_id email admin').exec();
		const jwtKey = process.env.JWT_KEY || 'secret';
		return jwt.sign({
			email: user!.email,
			_id: user!._id,
			admin: !!user!.admin,
		}, jwtKey);
}

function getHash(password: string): string {
	return bcrypt.hashSync(password, 10);
}