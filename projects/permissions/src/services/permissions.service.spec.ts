import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {FakePermissionStatus} from '../mocks/fake-permission-status';
import {FakePermissions} from '../mocks/fake-permissions';
import {PERMISSIONS} from '../tokens/permissions';
import {PERMISSIONS_SUPPORT} from '../tokens/permissions-support';
import {PermissionsService} from './permissions.service';

describe('PermissionsService', () => {
    let service: PermissionsService;
    let permissions: Permissions;
    let permissionStatus: FakePermissionStatus;
    const QUERY_DELAY = 300;

    /**
     * Creates a spy on permissions.query() call
     * We cannot put this code in the `beforeEach` block since it has a setTimeout
     * call, which would not work with the fakeAsync functionality. It needs to be run
     * in the context of the `it` callback.
     */
    function createQuerySpy(shouldReject: boolean = false): jasmine.Spy {
        const queryPromise = new Promise<PermissionStatus>((resolve, reject) => {
            // assign the object that will be resolved outside of the setTimeout block
            // so that we can set up spies on it early
            permissionStatus = new FakePermissionStatus('prompt');

            setTimeout(() => {
                if (shouldReject) {
                    reject(new Error('some error'));
                } else {
                    resolve(permissionStatus);
                }
            }, QUERY_DELAY);
        });

        return spyOn(permissions, 'query').and.returnValue(queryPromise);
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [{provide: PERMISSIONS, useClass: FakePermissions}],
        });

        service = TestBed.inject(PermissionsService);
        permissions = TestBed.inject(PERMISSIONS);
    });

    it('service init', () => {
        expect(service).toBeTruthy();
    });

    it('state() provides status', fakeAsync(() => {
        createQuerySpy();

        let actual: PermissionState | null = null as any;

        service.state('geolocation').subscribe(state => {
            actual = state;
        });

        expect(actual).toBe(null);

        tick(QUERY_DELAY);

        const expected: PermissionState = 'prompt';

        expect(actual).toBe(expected);
    }));

    it('state() provides status when it changes', fakeAsync(() => {
        createQuerySpy();

        let actual: PermissionState | null = null as any;

        service.state('geolocation').subscribe(state => {
            actual = state;
        });

        tick(QUERY_DELAY);

        permissionStatus.simulateStateChange('granted');

        const expected: PermissionState = 'granted';

        expect(actual).toBe(expected);
    }));

    it('state takes a PermissionDescriptor', fakeAsync(() => {
        createQuerySpy();

        let actual: PermissionState | null = null as any;

        service.state({name: 'geolocation'}).subscribe(state => {
            actual = state;
        });

        tick(QUERY_DELAY);

        const expected: PermissionState = 'prompt';

        expect(actual).toBe(expected);
    }));

    it('Provides status from cache if other subscriptions exist', () => {
        const querySpy = createQuerySpy();

        const obs = service.state('geolocation');

        obs.subscribe();

        expect(querySpy).toHaveBeenCalledTimes(1);

        obs.subscribe();

        expect(querySpy).toHaveBeenCalledTimes(1);
    });

    it('should not addEventListener if unsubscribed before query promise got resolved', fakeAsync(() => {
        createQuerySpy();

        const addEventListenerSpy = spyOn(
            permissionStatus,
            'addEventListener',
        ).and.callThrough();

        let actual: PermissionState | null = null as any;

        const sub = service.state('geolocation').subscribe(state => {
            actual = state;
        });

        sub.unsubscribe();

        tick(QUERY_DELAY);

        expect(actual).toBe(null);
        expect(addEventListenerSpy).not.toHaveBeenCalled();
    }));

    it('should clean up eventListener if it was added', fakeAsync(() => {
        createQuerySpy();

        const addEventListenerSpy = spyOn(
            permissionStatus,
            'addEventListener',
        ).and.callThrough();
        const removeEventListenerSpy = spyOn(
            permissionStatus,
            'removeEventListener',
        ).and.callThrough();

        const sub = service.state('geolocation').subscribe();

        expect(addEventListenerSpy).not.toHaveBeenCalled();

        tick(QUERY_DELAY);

        expect(addEventListenerSpy).toHaveBeenCalled();
        expect(removeEventListenerSpy).not.toHaveBeenCalled();

        sub.unsubscribe();

        expect(removeEventListenerSpy).toHaveBeenCalled();
    }));

    it('should throw error', fakeAsync(() => {
        let actualStatus: PermissionState = null as any;
        let actualError: Error = null as any;

        createQuerySpy(true);

        service.state('geolocation').subscribe(
            status => (actualStatus = status),
            error => (actualError = error),
        );

        tick(QUERY_DELAY);

        expect(actualStatus).toBeNull();
        expect(new Error('some error')).toEqual(actualError);
    }));
});

describe('PermissionsService is unsupported', () => {
    let service: PermissionsService;
    let permissions: Permissions;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                {provide: PERMISSIONS, useClass: FakePermissions},
                {provide: PERMISSIONS_SUPPORT, useValue: false},
            ],
        });

        service = TestBed.inject(PermissionsService);
        permissions = TestBed.inject(PERMISSIONS);
    });

    it('should throw an error and .query() should not be called', () => {
        const querySpy = spyOn(permissions, 'query').and.stub();
        let actualError: string = null as any;

        service.state('geolocation').subscribe(
            () => {},
            error => (actualError = error),
        );

        expect('Permissions is not supported in your browser').toBe(actualError);
        expect(querySpy).not.toHaveBeenCalled();
    });
});

describe('Token: PERMISSIONS', () => {
    let permissions: Permissions;

    beforeEach(() => {
        TestBed.configureTestingModule({});

        permissions = TestBed.inject(PERMISSIONS);
    });

    it('should be defined', () => {
        expect(permissions).toBeInstanceOf(window.Permissions);
    });
});
