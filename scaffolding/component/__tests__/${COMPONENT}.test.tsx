import * as React from 'react';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom';
import {${COMPONENT}} from '../index';

describe('<${COMPONENT} />', () => {
    it('should render without blowing up', () => {
        const result = render(<${COMPONENT}/>);
        expect(result.getByTestId('${TEST_ID}')).toBeInTheDocument();
    });
});
