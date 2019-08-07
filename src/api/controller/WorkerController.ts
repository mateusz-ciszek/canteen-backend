import { NextFunction, Response } from "express";
import { Types } from "mongoose";
import { IRequest } from "../../models/Express";
import { WorkerModelToWorkerListItemConverter } from "../converter/worker/WorkerModelToWorkerListItemConverter";
import { WorkHoursCreateRequestToWorkHoursModelConverter } from "../converter/worker/WorkHoursCreateRequestToWorkHoursModelConverter";
import { BcryptUtil } from "../helper/BcryptUtil";
import { DayOffHelper } from "../helper/DayOffHelper";
import { InvalidObjectIdError } from "../helper/repository/InvalidObjectIdError";
import { SaveUserCommand, UserRepository } from "../helper/repository/UserRepository";
import { SaveWorkerCommand, WorkerNotFoundError, WorkerRepository } from "../helper/repository/WorkerRepository";
import { DayOffChangeRequestValidator } from "../helper/validate/DayOffChangeRequestValidator";
import { DayOffRequestValidator } from "../helper/validate/DayOffRequestValidator";
import { WorkerValidator } from "../helper/validate/WorkerValidator";
import { NotObjectIdError, WorkerHelper } from '../helper/WorkerHelper';
import { WorkHoursHelper } from "../helper/WorkHoursHelper";
import { IWorkerCreateRequest } from "../interface/worker/create/IWorkerCreateRequest";
import { IWorkerCreateResponse } from "../interface/worker/create/IWorkerCreateResponse";
import { IDayOffChangeStatusRequest } from "../interface/worker/dayOff/changeState/IDayOffChangeStatusRequest";
import { IWorkerDayOffRequest } from "../interface/worker/dayOff/create/IWorkerDayOffRequest";
import { IWorkerDetailsRequest } from "../interface/worker/details/IWorkerDetailsRequest";
import { IWorkerDetailsResponse } from "../interface/worker/details/IWorkerDetailsResponse";
import { IWorkerListResponse } from "../interface/worker/list/IWorkerListResponse";
import { IMonthGetResponse } from "../interface/worker/month/IMonthGetResponse";
import { IMonthRequest } from "../interface/worker/month/IMonthRequest";
import { IWorkerPasswordResetRequest } from "../interface/worker/password/reset/IWorkerPasswordResetRequest";
import { IWorkerPasswordResetResponse } from "../interface/worker/password/reset/IWorkerPasswordResetResponse";
import { IWorkerGetPermissions } from "../interface/worker/permissions/get/IWorkerGetPermissions";
import { IWorkerUpdatePermissions } from "../interface/worker/permissions/update/IWorkerUpdatePermissions";
import { DayOff } from "../models/DayOff";
import { IWorkerModel, Worker } from "../models/worker";

export class WorkerController {
	private repository = new WorkerRepository();
	private bcrypt = new BcryptUtil();
	private workerHelper = new WorkerHelper();
	private userRepository = new UserRepository();

	async getPermissions(req: IRequest, res: Response, next: NextFunction): Promise<Response> {
		const request: IWorkerGetPermissions = req.params;
		let worker: IWorkerModel;

		try {
			worker = await this.repository.findWorkerById(request.workerId);
		} catch (err) {
			if (err instanceof InvalidObjectIdError) {
				return res.status(400).json();
			}
			if (err instanceof WorkerNotFoundError) {
				return res.status(404).json();
			}
			return res.status(500).json();
		}

		return res.status(200).json(worker.permissions);
	}

	async updatePermissions(req: IRequest, res: Response, next: NextFunction): Promise<Response> {
		const request: IWorkerUpdatePermissions = { ...req.body, ...req.params };
		
		if (!request.workerId || !request.permissions) {
			return res.status(400).json();
		}

		try {
			await this.repository.updatePermissions(request.workerId, request.permissions);
		} catch (err) {
			if (err instanceof InvalidObjectIdError) {
				return res.status(400).json();
			}
			if (err instanceof WorkerNotFoundError) {
				return res.status(404).json();
			}
			return res.status(500).json();
		}

		return res.status(200).json();
	}

	async getWorkersList(req: IRequest, res: Response, next: NextFunction): Promise<Response> {
		const allWorkers: IWorkerModel[] = await this.repository.getAllWorkers();
		const converter = new WorkerModelToWorkerListItemConverter();
		const response: IWorkerListResponse = { workers: allWorkers.map(worker => converter.convert(worker)) };
		return res.status(200).json(response);
	}

	async createWorker(req: IRequest, res: Response): Promise<Response> {
		const request: IWorkerCreateRequest = req.body;
	
		if (!request.workHours) {
			const helper = new WorkHoursHelper();
			request.workHours = helper.generateDefaultWorkHours();
		}
	
		const validator = new WorkerValidator();
		if (!validator.validateIWorkerCreateRequest(request)) {
			return res.status(400).json();
		}
	
		const email = await this.workerHelper.generateEmail(request.firstName, request.lastName);
		const password = this.workerHelper.generatePassword();
		const hash = await this.bcrypt.hashPassword(password);
	
		const userCommand: SaveUserCommand = {
			email: email,
			firstName: request.firstName,
			lastName: request.lastName,
			passwordHash: hash,
		};
		const userId = await this.userRepository.saveUser(userCommand);
		const workHoursConverter = new WorkHoursCreateRequestToWorkHoursModelConverter();
		const workerCommand: SaveWorkerCommand = {
			userId: userId,
			workHours: request.workHours.map(hours => workHoursConverter.convert(hours)),
		};
		await this.repository.saveWorker(workerCommand);
	
		const response: IWorkerCreateResponse = { email, password };
		return res.status(201).json(response);
	}

	async getMonth(req: IRequest, res: Response): Promise<Response> {
		const request: IMonthRequest = req.params;
	
		const workers = await this.repository.getAllWorkers();
		const month: IMonthGetResponse = await this.workerHelper.calculateMonth(request, workers);
		
		return res.status(200).json(month);
	}
}

export async function createDayOffRequest(req: IRequest, res: Response, next: NextFunction): Promise<Response> {
	const request: IWorkerDayOffRequest = req.body;

	const validator = new DayOffRequestValidator();
	if (!validator.validate(request)) {
		res.status(400).json();
	}

	const worker = await Worker.findOne({ 'person': { '_id': req.context!.userId } }).exec();
	if (!worker) {
		return res.status(400).json();
	}
	
	const helper = new DayOffHelper();
	let dates: Date[];
	try {
		dates = request.dates.map(helper.mapDateStringToDate);
	} catch (err) {
		return res.status(400).json();
	}
	
	dates = await helper.removeAlreadyRequestedDates(dates, worker._id);

	for (const date of dates) {
		await new DayOff({
			_id: new Types.ObjectId(),
			worker,
			date,
			state: 'UNRESOLVED',
		}).save();
	}

	return res.status(200).json();
}

export async function changeDayffState(req: IRequest, res: Response, next: NextFunction): Promise<Response> {
	const request: IDayOffChangeStatusRequest = req.body;

	const validator = new DayOffChangeRequestValidator();
	if (!validator.validate(request)) {
		return res.status(400).json();
	}

	const dayOffRequest = await DayOff.findById(request.id).exec();
	if (!dayOffRequest) {
		return res.status(400).json();
	}

	const worker = await Worker.findById(req.context!.userId).exec();

	dayOffRequest.state = request.state;
	dayOffRequest.resolvedBy = worker!;
	dayOffRequest.resolvedDate = new Date();
	await dayOffRequest.save();

	return res.status(200).json();
}

export async function getWorkerDetails(req: IRequest, res: Response, next: NextFunction): Promise<Response> {
	const request: IWorkerDetailsRequest = req.params;

	const workerHelper = new WorkerHelper();
	let details: IWorkerDetailsResponse | null = null;

	try {
		details = await workerHelper.getDetails(request.workerId);
	} catch (err) {
		if (err instanceof NotObjectIdError) {
			console.log(err.message);
			return res.status(400).json();
		} else if (err instanceof WorkerNotFoundError) {
			return res.status(404).json();
		} else {
			console.log(err);
			return res.status(500).json();
		}
	}

	return res.status(200).json(details);
}

export async function resetPassword(req: IRequest, res: Response, next: NextFunction): Promise<Response> {
	const request: IWorkerPasswordResetRequest = req.body;

	if (!request.workerId) {
		return res.status(400).json();
	}

	const workerHelper = new WorkerHelper(); // TODO: remove this and use one included in class after moving this
	const password = workerHelper.generatePassword();
	const bcrypt = new BcryptUtil(); // TODO: remove this and use one included in class after moving this
	const hash = await bcrypt.hashPassword(password);
	const worker = await workerHelper.getWorker(request.workerId);
	const user = worker.person;
	user.password = hash;
	await user.save();

	const response: IWorkerPasswordResetResponse = { email: user.email, password };
	return res.status(200).json(response);
}
