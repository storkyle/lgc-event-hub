// Unit tests for validation middleware
import { Request, Response, NextFunction } from 'express';
import { validateEventPayload } from '../../src/api/middleware/validation';
import { AppError } from '../../src/api/middleware/errorHandler';

describe('validateEventPayload', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {};
    mockNext = jest.fn();
  });

  it('should pass validation with valid event_type and payload', () => {
    mockReq.body = {
      event_type: 'user.created',
      payload: { user_id: '123' },
    };

    validateEventPayload(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
  });

  it('should throw error when event_type is missing', () => {
    mockReq.body = {
      payload: { user_id: '123' },
    };

    expect(() => {
      validateEventPayload(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
    }).toThrow(AppError);
  });

  it('should throw error when event_type is not a string', () => {
    mockReq.body = {
      event_type: 123,
      payload: { user_id: '123' },
    };

    expect(() => {
      validateEventPayload(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
    }).toThrow(AppError);
  });

  it('should throw error when payload is missing', () => {
    mockReq.body = {
      event_type: 'user.created',
    };

    expect(() => {
      validateEventPayload(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
    }).toThrow(AppError);
  });

  it('should throw error when payload is not an object', () => {
    mockReq.body = {
      event_type: 'user.created',
      payload: 'invalid',
    };

    expect(() => {
      validateEventPayload(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );
    }).toThrow(AppError);
  });
});

