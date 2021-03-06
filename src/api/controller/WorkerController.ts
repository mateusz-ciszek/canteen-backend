import { NextFunction, Response } from "express";
import { IRequest } from "../../models/Express";
import { StringToDateConverter } from "../converter/common/StringToDateConverter";
import { WorkerModelToWorkerDetailsResponseConverter } from "../converter/worker/WorkerModelToWorkerDetailsResponseConnverter";
import { WorkerModelToWorkerListItemConverter } from "../converter/worker/WorkerModelToWorkerListItemConverter";
import { WorkHoursCreateRequestToWorkHoursModelConverter } from "../converter/worker/WorkHoursCreateRequestToWorkHoursModelConverter";
import { BcryptUtil } from "../helper/BcryptUtil";
import { DayOffUtil } from "../helper/DayOffUtil";
import { EmailFactory } from "../helper/EmailFactory";
import { IPasswordFactory } from "../helper/IPasswordFactory";
import { PasswordFactoryImpl } from "../helper/PasswordFactoryImpl";
import { WorkerHelper } from '../helper/WorkerHelper';
import { WorkHoursHelper } from "../helper/WorkHoursHelper";
import { IWorkerCreateRequest } from "../interface/worker/create/IWorkerCreateRequest";
import { IWorkerCreateResponse } from "../interface/worker/create/IWorkerCreateResponse";
import { IDayOffChangeStatusRequest } from "../interface/worker/dayOff/changeState/IDayOffChangeStatusRequest";
import { IWorkerDayOffRequest } from "../interface/worker/dayOff/create/IWorkerDayOffRequest";
import { IWorkerDetailsRequest } from "../interface/worker/details/IWorkerDetailsRequest";
import { IWorkerListResponse } from "../interface/worker/list/IWorkerListResponse";
import { IMonthGetResponse } from "../interface/worker/month/IMonthGetResponse";
import { IMonthRequest } from "../interface/worker/month/IMonthRequest";
import { IWorkerPasswordResetRequest } from "../interface/worker/password/reset/IWorkerPasswordResetRequest";
import { IWorkerPasswordResetResponse } from "../interface/worker/password/reset/IWorkerPasswordResetResponse";
import { IWorkerGetPermissions } from "../interface/worker/permissions/get/IWorkerGetPermissions";
import { IWorkerUpdatePermissions } from "../interface/worker/permissions/update/IWorkerUpdatePermissions";
import { IDayOffModel } from "../models/DayOff";
import { IWorkerModel } from "../models/worker";
import { DayOffNotFoundError, DayOffRepositoryImpl } from "../repository/DayOffRepositoryImpl";
import { DayOffFilter, IDayOffRepository, SaveDayOffCommand } from "../repository/IDayOffRepository";
import { InvalidObjectIdError } from "../repository/InvalidObjectIdError";
import { SaveUserCommand, UserRepository } from "../repository/UserRepository";
import { SaveWorkerCommand, WorkerNotFoundError, WorkerRepository } from "../repository/WorkerRepository";
import { DayOffChangeRequestValidator } from "../validate/worker/DayOffChangeRequestValidator";
import { DayOffRequestValidator } from "../validate/worker/DayOffRequestValidator";
import { WorkerValidator } from "../validate/worker/WorkerValidator";

export class WorkerController {
	private repository = new WorkerRepository();
	private bcrypt = new BcryptUtil();
	private workerHelper = new WorkerHelper();
	private userRepository = new UserRepository();
	private dayOffRepository: IDayOffRepository = new DayOffRepositoryImpl();
	private passwordFactory: IPasswordFactory = new PasswordFactoryImpl();
	private dayOffUtil = new DayOffUtil(this.dayOffRepository);

	async getPermissions(req: IRequest, res: Response): Promise<Response> {
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

	async updatePermissions(req: IRequest, res: Response): Promise<Response> {
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

	async getWorkersList(req: IRequest, res: Response): Promise<Response> {
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
		if (!validator.validate(request)) {
			return res.status(400).json();
		}
	
		const emailFactory = new EmailFactory();
		const email = await emailFactory.generate(request.firstName, request.lastName);
		const password = this.passwordFactory.generate();
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

	async getWorkerDetails(req: IRequest, res: Response): Promise<Response> {
		const request: IWorkerDetailsRequest = req.params;
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

		const filter: DayOffFilter = {
			workerId: request.workerId,
		};
		const dayOffRequests = await this.dayOffRepository.find(filter);
		const converter = new WorkerModelToWorkerDetailsResponseConverter();
		const response = converter.convert(worker, dayOffRequests);
	
		return res.status(200).json(response);
	}

	async getMonth(req: IRequest, res: Response): Promise<Response> {
		const request: IMonthRequest = req.params;
	
		const workers = await this.repository.getAllWorkers();
		const month: IMonthGetResponse = await this.workerHelper.calculateMonth(request, workers);
		
		return res.status(200).json(month);
	}

	async createDayOffRequest(req: IRequest, res: Response): Promise<Response> {
		const request: IWorkerDayOffRequest = req.body;
	
		const validator = new DayOffRequestValidator();
		if (!validator.validate(request)) {
			res.status(400).json();
		}
	
		let worker: IWorkerModel;
		try {
			worker = await this.repository.findWorkerById(req.context!.workerId!);
		} catch (err) {
			if (err instanceof InvalidObjectIdError) {
				return res.status(400).json();
			}
			if (err instanceof WorkerNotFoundError) {
				return res.status(404).json();
			}
			return res.status(500).json();
		}
		
		const dateConverter = new StringToDateConverter();
		let dates = request.dates.map(date => dateConverter.convert(date));
		dates = await this.dayOffUtil.filterOutExistingDates(dates, worker._id);
	
		for (const date of dates) {
			const command: SaveDayOffCommand = { worker, date };
			await this.dayOffRepository.save(command);
		}
	
		return res.status(200).json();
	}

	async changeDayOffState(req: IRequest, res: Response): Promise<Response> {
		const request: IDayOffChangeStatusRequest = req.body;
		let dayOff: IDayOffModel;
	
		const validator = new DayOffChangeRequestValidator();
		if (!validator.validate(request)) {
			return res.status(400).json();
		}
	
		try {
			dayOff = await this.dayOffRepository.findDayOffById(request.id);
		} catch (err) {
			if (err instanceof InvalidObjectIdError) {
				return res.status(400).json();
			}
			if (err instanceof DayOffNotFoundError) {
				return res.status(404).json();
			}
			return res.status(500).json();
		}
	
		const worker = await this.repository.findWorkerById(req.context!.workerId!);
		dayOff.state = request.state;
		dayOff.resolvedBy = worker;
		dayOff.resolvedDate = new Date();
		await dayOff.save();
	
		return res.status(200).json();
	}

	async resetPassword(req: IRequest, res: Response): Promise<Response> {
		const request: IWorkerPasswordResetRequest = req.body;
	
		if (!request.workerId) {
			return res.status(400).json();
		}
	
		const password = this.passwordFactory.generate();
		const hash = await this.bcrypt.hashPassword(password);
		const worker = await this.repository.findWorkerById(request.workerId);
		const user = worker.person;
		user.password = hash;
		await user.save();
	
		const response: IWorkerPasswordResetResponse = {
			email: user.email,
			password: password,
		};
		return res.status(200).json(response);
	}
}
