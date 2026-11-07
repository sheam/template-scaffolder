import { BaseApiClient } from './common';

/** Tank kinds. */
export enum TankType {
  Fermenter = 'Fermenter',
  BrightTank = 'BrightTank',
  Kettle = 3,
}

export interface IApiSuccessResponseDTOOfGetTanksResponseDTO extends IApiSuccessResponseDTO {
  Content?: IGetTanksResponseDTO | undefined;
}

export interface IGetTanksResponseDTO {
  TotalCount: number;
  Tanks?: ITankDTO[] | undefined;
}

export interface ITankDTO {
  TankId: number;
  Name?: string | undefined;
  readonly Type: TankType;
}

export type TankStatus = 'empty' | 'full';

export class TanksApiClient extends BaseApiClient implements IClient {
  private readonly baseUrl: string;

  /** Fetch one page of tanks. */
  getTanks(pageSize: number, pageNumber?: number | undefined): Promise<IApiSuccessResponseDTOOfGetTanksResponseDTO> {
    let options_: RequestInit = {
      method: "GET",
    };
    return this.http.fetch(this.baseUrl, options_);
  }

  deleteTank(tankId: number): Promise<void> {
    let options_: RequestInit = {
      method: "DELETE",
    };
    return this.http.fetch(this.baseUrl, options_);
  }

  protected static async processGetTanks(response: Response): Promise<void> {}
}

export async function helper(a: string, b = 2): Promise<number> {
  return b;
}

export const arrow = (x: number): string => String(x);

export namespace Legacy {
  export interface IOld {
    id: number;
  }
}
