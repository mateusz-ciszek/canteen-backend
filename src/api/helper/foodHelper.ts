import { Types } from 'mongoose';
import { Food, IFoodModel } from '../models/food';
import { FoodAddition } from '../models/foodAddition';
import { onlyUnique } from '../../common/helper/arrayHelper';
import { IFoodCreateRequest } from '../interface/menu/create/IFoodCreateRequest';

export async function saveFood(food: IFoodCreateRequest): Promise<IFoodModel> {
	let additionIds: string[] = [];
	if (food.additions && food.additions.length) {
		additionIds = await saveFoodAdditions(food.additions);
	}

	// TODO dodać zapisywanie grafiki posiłku jeśli zostanie przesłana
	const savedFood = await new Food({
		_id: Types.ObjectId(),
		name: food.name,
		price: food.price,
		description: food.description || '',
		additions: additionIds,
	}).save();
	return savedFood;
};

export async function getFoodDetails(foodId: string): Promise<IFoodModel | null> {
	return await Food.findById(foodId).exec();
};

export function validateCreateFoodRequest(food: any): string[] {
	const errors: string[] = [];

	if (!food.name) {
		errors.push('Food name is required');
	} else if (food.name.length < 3) {
		errors.push('Food name have to be at least 3 characters long');

	}

	if (!food.price) {
		errors.push('Food price is required');
	} else if (food.price < 0) {
		errors.push('Food price have to be at least 0');
	}

	if (food.additions) {
		const additionErrors: string[] = [];
		// Validate all additions and collect all errors
		food.additions.map((addition: any) => validateCreateFoodAdditionRequest(addition).forEach(error => additionErrors.push(error)));
		if (additionErrors.length) {
			// Add only unique addition errors to errors
			errors.push(...additionErrors.filter(onlyUnique));
		}
	}

	return errors;
};

async function saveFoodAdditions(additions: any): Promise<string[]> {
	const ids: string[] = [];
	if (additions) {
		for (const add of additions) {
			const saved = await new FoodAddition({
				_id: Types.ObjectId(),
				name: add.name,
				price: add.price,
			}).save();
			ids.push(saved._id);
		}
	}
	return ids;
};

function validateCreateFoodAdditionRequest(addition: any): string[] {
	const errors: string[] = [];

	if (!addition.name) {
		errors.push('Food addition name is required');
	} else if (addition.name.length < 3) {
		errors.push('Food addition name have to be at least 3 characters long');
	}

	if (!addition.price) {
		errors.push('Food addition price is required');
	} else if (addition.price < 0) {
		errors.push('Food addition price have to be at least 0');
	}

	return errors;
}