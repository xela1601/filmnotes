import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';

describe('toolchain scaffold', () => {
  it('renders a react-native tree', async () => {
    await render(
      <View>
        <Text>hello</Text>
      </View>,
    );
    expect(screen.getByText('hello')).toBeOnTheScreen();
  });
});
