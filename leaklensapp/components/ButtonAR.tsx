import { StyleSheet, View, Pressable, Text } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

type Props = {
  label: string;
  theme2?: 'secondary';
};

export default function Button({ label, theme2 }: Props) {
  if (theme2 === 'secondary') {
    return (
      <View
        style={[
          styles.buttonContainer,
          { borderWidth: 3, borderColor: '#0bfffe', borderRadius: 18 },
        ]}>
    
      </View>
    );
  }

  return (
    <View style={styles.buttonContainer}>
      
    </View>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    width: 320,
    height: 68,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  button: {
    borderRadius: 10,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    paddingRight: 8,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
  },
});