import { Converter } from "../Converter";
import { IWorkerModel } from "../../models/worker";
import { IWorkerView } from "../../interface/worker/month/IWorkerView";
import { UserModelToUserViewConverter } from "../common/UserModelToUserViewConverter";

export class WorkerModelToWorkerViewConverter implements Converter<IWorkerModel, IWorkerView> {
	convert(input: IWorkerModel): IWorkerView {
		const converter = new UserModelToUserViewConverter();

		return {
			id: input._id,
			person: converter.convert(input.person),
			defaultWorkHours: input.defaultWorkHours,
		};
	}
}