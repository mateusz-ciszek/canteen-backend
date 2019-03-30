import mongoose, { Model, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import { ObjectId } from 'bson';
import { User } from '../../api/models/user';
import { Food } from '../../api/models/food';
import { Menu } from '../../api/models/menu';
import { FoodAddition } from '../../api/models/foodAddition';
import { Order } from '../../api/models/order';
import { OrderItem } from '../../api/models/orderItem';
import { OrderItemAddition } from '../../api/models/orderItemAddition';
import { OrderState } from '../../api/models/orderState';

export class DatabaseTestHelper {
	private id: ObjectId | null = null;

	public readonly STANDARD_USER = {
		ID: '',
		FIRST_NAME: 'Amanda',
		LAST_NAME: 'Fishsticks',
		EMAIL: 'test_user@canteen.com',
		PASSWORD: 'password',
	};

	public readonly ADMIN_USER = {
		ID: '',
		FIRST_NAME: 'Felix',
		LAST_NAME: 'Fitzgerald',
		EMAIL: 'test_admin@canteen.com',
		PASSWORD: 'password',
	};

	public readonly UNSAVED_USER = {
		ID: '',
		FIRST_NAME: 'Sam',
		LAST_NAME: 'Mayo',
		EMAIL: 'test_unsaved@canteen.com',
		PASSWORD: 'password',
	}

	public readonly MENU = {
		ID: '',
		NAME: 'Breakfase Menu',
		FOODS: [],
	}

	public readonly FOOD = {
		ID: '',
		NAME: 'Omelette Sandwich',
		PRICE: 15.99,
		DESCRIPTION: 'Just a fancy sandwich',
		ADDITIONS: [],
	}

	public readonly FOOD_ADDITION = {
		ID: '',
		NAME: 'Mayo',
		PRICE: .99,
	}

	public readonly ORDER_ITEM_ADDITION = {
		ID: '',
		FOOD_ADDITION: '',
		QUANTITY: 1,
		PRICE: this.FOOD_ADDITION.PRICE,
	}

	public readonly ORDER_ITEM = {
		ID: '',
		FOOD: '',
		QUANTITY: 1,
		PRICE: this.FOOD.PRICE + this.FOOD_ADDITION.PRICE,
		ADDITIONS: [this.ORDER_ITEM_ADDITION.ID],
	}

	public readonly ORDER_STATE = {
		STATE: 'SAVED',
		ENTERED_BY: '',
	}

	public readonly ORDER = {
		ID: '',
		USER: '',
		ITEMS: [this.ORDER_ITEM.ID],
		TOTAL_PRICE: this.FOOD.PRICE + this.FOOD_ADDITION.PRICE,
		COMMENT: '',
	}

	public async initDatabase(): Promise<void> {
		await this.connect();

		await this.saveUsers();
		await this.saveFood();
		await this.saveMenu();
		await this.saveOrder();

		await this.disconnect();
	}

	public async dropDatabase(): Promise<void> {
		await this.connect();
		await User.deleteMany({}).exec();
		await FoodAddition.deleteMany({}).exec();
		await Food.deleteMany({}).exec();
		await Menu.deleteMany({}).exec();
		await Order.deleteMany({}).exec();
		await OrderItem.deleteMany({}).exec();
		await OrderItemAddition.deleteMany({}).exec();
		await this.disconnect();
	}

	public async connect(): Promise<typeof mongoose> {
		return await mongoose.connect(
			`mongodb+srv://test:test-dev@canteen-application-dev-hkbxg.mongodb.net/test-dev?retryWrites=true`,
			{ useNewUrlParser: true, useCreateIndex: true }
		);
	}

	public async disconnect(): Promise<void> {
		return await mongoose.disconnect();
	}

	public generateObjectId(): ObjectId {
		return mongoose.Types.ObjectId();
	}

	private async saveUsers(): Promise<void> {
		const hash = await bcrypt.hash(this.STANDARD_USER.PASSWORD, 10);

		this.id = this.generateObjectId();
		await new User({
			_id: this.id,
			email: this.STANDARD_USER.EMAIL,
			firstName: this.STANDARD_USER.FIRST_NAME,
			lastName: this.STANDARD_USER.LAST_NAME,
			password: hash,
			admin: false,
		}).save();
		this.STANDARD_USER.ID = this.id.toString();

		this.id = this.generateObjectId();
		await new User({
			_id: this.id,
			email: this.ADMIN_USER.EMAIL,
			firstName: this.ADMIN_USER.FIRST_NAME,
			lastName: this.ADMIN_USER.LAST_NAME,
			password: hash,
			admin: true,
		}).save();
		this.ADMIN_USER.ID = this.id.toString();
	}

	private async saveFood(): Promise<void> {
		this.id = this.generateObjectId();
		await new FoodAddition({
			_id: this.id,
			name: this.FOOD_ADDITION.NAME,
			price: this.FOOD_ADDITION.PRICE,
		}).save();
		this.FOOD_ADDITION.ID = this.id.toString();

		this.id = this.generateObjectId();
		await new Food({
			_id: this.id,
			name: this.FOOD.NAME,
			price: this.FOOD.PRICE,
			description: this.FOOD.DESCRIPTION,
			additions: [this.FOOD_ADDITION.ID],
		}).save();
		this.FOOD.ID = this.id.toString();
	}

	private async saveMenu(): Promise<void> {
		this.id = this.generateObjectId();
		await new Menu({
			_id: this.id,
			name: this.MENU.NAME,
			foods: [this.FOOD.ID],
		}).save();
		this.MENU.ID = this.id.toString();
	}

	private async saveOrder(): Promise<void> {
		this.ORDER_ITEM_ADDITION.FOOD_ADDITION = this.FOOD_ADDITION.ID;
		this.ORDER_ITEM.FOOD = this.FOOD.ID;
		this.ORDER.USER = this.STANDARD_USER.ID;
		this.ORDER_STATE.ENTERED_BY = this.STANDARD_USER.ID;

		this.id = this.generateObjectId();
		await new OrderItemAddition({
			_id: this.id,
			foodAddition: this.ORDER_ITEM_ADDITION.FOOD_ADDITION,
			quantity: this.ORDER_ITEM_ADDITION.QUANTITY,
			price: this.ORDER_ITEM_ADDITION.PRICE,
		}).save();
		this.ORDER_ITEM_ADDITION.ID = this.id.toString();

		this.id = this.generateObjectId();
		await new OrderItem({
			_id: this.id,
			food: this.ORDER_ITEM.FOOD,
			quantity: this.ORDER_ITEM.QUANTITY,
			additions: [this.ORDER_ITEM_ADDITION.ID],
			price: this.ORDER_ITEM.PRICE,
		}).save();
		this.ORDER_ITEM.ID = this.id.toString();
		
		this.ORDER.ITEMS = [this.ORDER_ITEM.ID];

		const state = new OrderState({
			state: this.ORDER_STATE.STATE,
			enteredBy: this.ORDER_STATE.ENTERED_BY,
		});

		this.id = this.generateObjectId();
		await new Order({
			_id: this.id,
			user: this.ORDER.USER,
			items: this.ORDER.ITEMS,
			totalPrice: this.ORDER.TOTAL_PRICE,
			history: [state],
			currentState: state,
			comment: this.ORDER.COMMENT,
			createdDate: new Date(),
		}).save();
		this.ORDER.ID = this.id.toString();
	}
}