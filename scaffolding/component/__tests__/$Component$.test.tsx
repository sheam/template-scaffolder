import * as React from 'react';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom';
import {$Component$} from '../index';

describe('<$Component$ />', () => {
    it('should render without blowing up', () => {
        const result = render(<$Component$/>);
        expect(result.getByTestId('$TestId$')).toBeInTheDocument();
    });
});
